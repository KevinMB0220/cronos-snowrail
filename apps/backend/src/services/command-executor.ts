/**
 * Command Executor Service
 *
 * Executes chat commands by integrating with payment services
 * - Connects CommandParser with IntentService, MixerService, WalletService
 * - Handles command execution and returns formatted responses
 * - Sends real-time notifications via WebSocket
 */

import type { FastifyInstance } from 'fastify';
import type { CommandParams, ChatCommand } from '@cronos-x402/shared-types';
import { intentService } from './intent-service';
import { getMixerService } from './mixer-service';
import { walletService } from './wallet-service';
import { parseCommand, validateCommand, getHelpText } from './command-parser';
import { createNotification } from './notification-service';
import { ethers } from 'ethers';

export interface CommandExecutionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Execute a chat command
 */
export async function executeCommand(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  content: string
): Promise<CommandExecutionResult> {
  // Parse command
  const parsed = parseCommand(content);

  if (!parsed) {
    return {
      success: false,
      message: 'Not a command. Type /help to see available commands.',
      error: 'INVALID_COMMAND'
    };
  }

  // Validate command
  const validation = validateCommand(parsed);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error || 'Invalid command',
      error: 'VALIDATION_ERROR'
    };
  }

  // Execute command based on type
  try {
    switch (parsed.command) {
      case '/pay':
        return await executePay(server, userId, userAddress, parsed.args);

      case '/deposit':
        return await executeDeposit(server, userId, userAddress, parsed.args);

      case '/withdraw':
        return await executeWithdraw(server, userId, userAddress, parsed.args);

      case '/mix':
        return await executeMix(server, userId, userAddress, parsed.args);

      case '/status':
        return await executeStatus(server, userId, userAddress, parsed.args);

      case '/wallet':
        return await executeWallet(server, userId, userAddress, parsed.args);

      case '/history':
        return await executeHistory(server, userId, userAddress, parsed.args);

      case '/help':
        return await executeHelp(server, userId, userAddress, parsed.args);

      default:
        return {
          success: false,
          message: `Command ${parsed.command} is not yet implemented`,
          error: 'NOT_IMPLEMENTED'
        };
    }
  } catch (error) {
    server.log.error({ error, command: parsed.command }, 'Command execution error');
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Command execution failed',
      error: 'EXECUTION_ERROR'
    };
  }
}

// ============ Command Implementations ============

/**
 * /pay <recipient> <amount> [currency]
 * Creates a payment intent
 */
async function executePay(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  const recipient = args[0];
  const amount = args[1];
  const currency = args[2]?.toUpperCase() || 'CRO';

  // Create payment intent
  const intent = intentService.create(
    {
      amount,
      currency,
      recipient,
      condition: { type: 'manual' },
    },
    userAddress // owner
  );

  // Send notification
  await createNotification(server, userId, {
    type: 'intent_created',
    title: '💰 Payment Intent Created',
    message: `Intent ${intent.intentId} for ${amount} ${currency} to ${recipient.slice(0, 10)}...`,
    priority: 'medium',
    data: { intentId: intent.intentId, amount, currency, recipient },
    actions: [
      { label: 'Deposit Now', command: `/deposit ${intent.intentId} ${amount}`, style: 'primary' },
      { label: 'Cancel', command: `/cancel ${intent.intentId}`, style: 'secondary' }
    ]
  });

  const response = formatPaymentIntentResponse(intent);

  return {
    success: true,
    message: response,
    data: {
      intentId: intent.intentId,
      amount,
      currency,
      recipient,
      status: intent.status
    }
  };
}

/**
 * /deposit <intentId> <amount>
 * Fund an existing intent
 */
async function executeDeposit(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  const intentId = args[0];
  const amount = args[1];

  // Get intent
  const intent = intentService.getById(intentId);
  if (!intent) {
    return {
      success: false,
      message: `Intent ${intentId} not found`,
      error: 'INTENT_NOT_FOUND'
    };
  }

  // Verify ownership
  if (intent.owner && intent.owner !== userAddress) {
    return {
      success: false,
      message: 'You do not own this intent',
      error: 'UNAUTHORIZED'
    };
  }

  // Check if already funded
  if (intent.status === 'funded') {
    return {
      success: false,
      message: 'Intent is already funded',
      error: 'ALREADY_FUNDED'
    };
  }

  // Get settlement contract address
  const contractAddress = process.env.SETTLEMENT_CONTRACT_ADDRESS;
  if (!contractAddress) {
    return {
      success: false,
      message: 'Settlement contract not configured',
      error: 'CONFIG_ERROR'
    };
  }

  // Create deposit info (user needs to sign this transaction)
  const depositInfo = {
    contract: contractAddress,
    amount,
    method: 'deposit',
    params: {
      intentId: intent.intentId,
      recipient: intent.recipient,
      amount: ethers.parseEther(amount).toString()
    }
  };

  // Send notification with transaction preview
  await createNotification(server, userId, {
    type: 'transaction_pending',
    title: '📥 Deposit Transaction Ready',
    message: `Please sign the transaction to deposit ${amount} ${intent.currency}`,
    priority: 'high',
    data: { intentId, depositInfo },
    actions: [
      { label: 'Sign Transaction', command: 'SIGN_TX', style: 'primary' }
    ]
  });

  const response = formatDepositResponse(intent, depositInfo);

  return {
    success: true,
    message: response,
    data: {
      intentId,
      depositInfo,
      requiresSignature: true
    }
  };
}

/**
 * /withdraw <noteOrIntentId>
 * Withdraw from mixer or cancel intent
 */
async function executeWithdraw(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  const noteOrIntentId = args[0];

  // Check if it's a mixer note (starts with mixer_)
  if (noteOrIntentId.startsWith('mixer_')) {
    return await executeWithdrawFromMixer(server, userId, userAddress, noteOrIntentId);
  }

  // Otherwise, treat as intent cancellation
  const intent = intentService.getById(noteOrIntentId);
  if (!intent) {
    return {
      success: false,
      message: `Intent or note ${noteOrIntentId} not found`,
      error: 'NOT_FOUND'
    };
  }

  // Verify ownership
  if (intent.owner && intent.owner !== userAddress) {
    return {
      success: false,
      message: 'You do not own this intent',
      error: 'UNAUTHORIZED'
    };
  }

  // Check if can be cancelled
  if (intent.status === 'executed') {
    return {
      success: false,
      message: 'Cannot cancel executed intent',
      error: 'CANNOT_CANCEL'
    };
  }

  return {
    success: true,
    message: `⚠️ Intent cancellation coming soon!\n\nIntent: ${noteOrIntentId}\nStatus: ${intent.status}`,
    data: { intentId: noteOrIntentId, status: intent.status }
  };
}

/**
 * Withdraw from mixer (private)
 */
async function executeWithdrawFromMixer(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  mixerNote: string
): Promise<CommandExecutionResult> {
  // TODO: Parse mixer note and generate withdrawal proof
  // For now, return instructions

  return {
    success: true,
    message: `🎭 Privacy Mixer Withdrawal\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Note: ${mixerNote}\n` +
      `Withdrawal to: ${userAddress}\n\n` +
      `⚠️ Mixer withdrawals are coming soon!\n` +
      `Your funds are safe and can be withdrawn once the feature is complete.`,
    data: { mixerNote, recipient: userAddress }
  };
}

/**
 * /mix <amount>
 * Deposit to privacy mixer
 */
async function executeMix(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  const amount = args[0];

  try {
    const mixerService = getMixerService();
    const denomination = mixerService.getDenomination();

    // Validate amount matches denomination
    if (amount !== denomination) {
      return {
        success: false,
        message: `Mixer only accepts fixed denomination of ${denomination} CRO`,
        error: 'INVALID_AMOUNT'
      };
    }

    // Generate deposit note
    const note = mixerService.generateDepositNote();

    // Get mixer contract address
    const contractAddress = process.env.MIXER_CONTRACT_ADDRESS;
    if (!contractAddress) {
      return {
        success: false,
        message: 'Mixer contract not configured',
        error: 'CONFIG_ERROR'
      };
    }

    // Create deposit info for frontend
    const depositInfo = {
      contract: contractAddress,
      amount: denomination,
      method: 'deposit',
      params: {
        commitment: note.commitment
      }
    };

    // Send notification with mixer note (CRITICAL - user must save this!)
    await createNotification(server, userId, {
      type: 'mixer_deposit_ready',
      title: '🎭 Privacy Mixer - SAVE THIS NOTE!',
      message: `⚠️ YOU MUST SAVE THIS NOTE TO WITHDRAW YOUR FUNDS!\n\nNote will be shown after deposit confirmation.`,
      priority: 'critical',
      data: {
        note: {
          commitment: note.commitment,
          // Don't send secrets yet - wait for confirmation
        },
        depositInfo
      },
      actions: [
        { label: 'Sign Deposit', command: 'SIGN_TX', style: 'primary' }
      ],
      dismissible: false
    });

    const response = formatMixerDepositResponse(note, depositInfo);

    return {
      success: true,
      message: response,
      data: {
        note, // Include full note in API response
        depositInfo,
        requiresSignature: true,
        warning: 'YOU MUST SAVE THE NOTE SECURELY!'
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Mixer service error',
      error: 'MIXER_ERROR'
    };
  }
}

/**
 * /status [intentId]
 * Check intent or wallet status
 */
async function executeStatus(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  if (args.length === 0) {
    // Show wallet status
    return executeWallet(server, userId, userAddress, args);
  }

  const intentId = args[0];
  const intent = intentService.getById(intentId);

  if (!intent) {
    return {
      success: false,
      message: `Intent ${intentId} not found`,
      error: 'INTENT_NOT_FOUND'
    };
  }

  const response = formatIntentStatusResponse(intent);

  return {
    success: true,
    message: response,
    data: intent
  };
}

/**
 * /wallet
 * Show wallet balance and info
 */
async function executeWallet(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  try {
    // Get wallet balance
    const balance = await walletService.getBalance(userAddress);

    // Get user's intents
    const allIntents = intentService.getAll();
    const userIntents = allIntents.filter(intent => intent.owner === userAddress);

    const response = formatWalletResponse(userAddress, balance, userIntents);

    return {
      success: true,
      message: response,
      data: {
        address: userAddress,
        balance,
        intentsCount: userIntents.length
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get wallet info',
      error: 'WALLET_ERROR'
    };
  }
}

/**
 * /history [limit]
 * Show transaction history
 */
async function executeHistory(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  const limit = args.length > 0 ? parseInt(args[0]) : 10;

  // Get user's intents
  const allIntents = intentService.getAll();
  const userIntents = allIntents
    .filter(intent => intent.owner === userAddress)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  const response = formatHistoryResponse(userIntents);

  return {
    success: true,
    message: response,
    data: { intents: userIntents, limit }
  };
}

/**
 * /help [command]
 * Show help text
 */
async function executeHelp(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  const command = args.length > 0 ? args[0] : undefined;
  const helpText = getHelpText(command);

  return {
    success: true,
    message: helpText,
    data: { command }
  };
}

// ============ Response Formatters ============

function formatPaymentIntentResponse(intent: any): string {
  return `💰 Payment Intent Created
━━━━━━━━━━━━━━━━━━━━━━━
Intent ID: ${intent.intentId}
To: ${intent.recipient}
Amount: ${intent.amount} ${intent.currency}
Status: ⏳ ${intent.status}

Next step: Deposit funds to execute the payment
Command: /deposit ${intent.intentId} ${intent.amount}`;
}

function formatDepositResponse(intent: any, depositInfo: any): string {
  return `📥 Deposit Transaction Ready
━━━━━━━━━━━━━━━━━━━━━━━
Intent: ${intent.intentId}
Amount: ${intent.amount} ${intent.currency}
Contract: ${depositInfo.contract}

⚠️ Please sign the transaction in your wallet to deposit funds.
Once confirmed, the payment will be automatically executed.`;
}

function formatMixerDepositResponse(note: any, depositInfo: any): string {
  return `🎭 Privacy Mixer Deposit
━━━━━━━━━━━━━━━━━━━━━━━
Amount: ${depositInfo.amount} CRO
Contract: ${depositInfo.contract}

⚠️⚠️⚠️ CRITICAL - SAVE THIS NOTE! ⚠️⚠️⚠️

Commitment: ${note.commitment}
Nullifier: ${note.nullifier}
Secret: ${note.secret}

⚠️ If you lose this note, your funds CANNOT be recovered!

Please:
1. Copy this note to a secure location
2. Sign the deposit transaction
3. Wait for confirmation
4. Use /withdraw with your note to retrieve funds anonymously`;
}

function formatIntentStatusResponse(intent: any): string {
  const statusEmoji = {
    pending: '⏸️',
    funded: '✅',
    executed: '✅',
    failed: '❌'
  }[intent.status] || '❓';

  return `📊 Intent Status
━━━━━━━━━━━━━━━━━━━━━━━
Intent ID: ${intent.intentId}
Status: ${statusEmoji} ${intent.status}
Recipient: ${intent.recipient}
Amount: ${intent.amount} ${intent.currency}
Created: ${new Date(intent.createdAt).toLocaleString()}
${intent.txHash ? `\nTX Hash: ${intent.txHash}` : ''}

${intent.status === 'pending' ? 'Next: /deposit to fund this intent' : ''}`;
}

function formatWalletResponse(address: string, balance: string, intents: any[]): string {
  const pendingIntents = intents.filter(i => i.status === 'pending').length;
  const executedIntents = intents.filter(i => i.status === 'executed').length;

  return `👛 Your Wallet
━━━━━━━━━━━━━━━━━━━━━━━
Address: ${address.slice(0, 10)}...${address.slice(-8)}
Balance: ${balance} CRO

Active Intents:
⏸️ Pending: ${pendingIntents}
✅ Executed: ${executedIntents}
📊 Total: ${intents.length}

Type /history to see recent transactions
Type /status <intentId> to check a specific intent`;
}

function formatHistoryResponse(intents: any[]): string {
  if (intents.length === 0) {
    return `📜 Transaction History
━━━━━━━━━━━━━━━━━━━━━━━
No transactions yet.

Type /pay to create your first payment!`;
  }

  const lines = [`📜 Transaction History (${intents.length})`, '━━━━━━━━━━━━━━━━━━━━━━━'];

  intents.forEach(intent => {
    const statusEmoji = {
      pending: '⏸️',
      funded: '💰',
      executed: '✅',
      failed: '❌'
    }[intent.status] || '❓';

    const date = new Date(intent.createdAt).toLocaleDateString();
    lines.push(`${statusEmoji} ${intent.amount} ${intent.currency} → ${intent.recipient.slice(0, 10)}...`);
    lines.push(`   ${date} | ${intent.intentId}`);
  });

  lines.push('\nType /status <intentId> for details');

  return lines.join('\n');
}
