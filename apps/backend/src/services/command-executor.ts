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
import { NotificationType } from '@cronos-x402/shared-types';
import { intentService } from './intent-service';
import { getMixerService } from './mixer-service';
import { getWalletService } from './wallet-service';
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

      case '/cancel':
        return await executeCancel(server, userId, userAddress, parsed.args);

      case '/bulk':
        return await executeBulk(server, userId, userAddress, parsed.args);

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
      condition: { type: 'manual', value: '' },
    },
    userAddress // owner
  );

  // Send notification
  await createNotification(userId, {
    type: NotificationType.INTENT_CREATED,
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
  await createNotification(userId, {
    type: NotificationType.TRANSACTION_PENDING,
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
 *
 * The user needs to provide their note in format:
 * /withdraw <nullifier> <secret> <leafIndex>
 *
 * Or as a single encoded string:
 * /withdraw mixer_<base64(JSON)>
 */
async function executeWithdrawFromMixer(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  mixerNote: string
): Promise<CommandExecutionResult> {
  try {
    const mixerService = getMixerService();
    const contractAddress = process.env.MIXER_CONTRACT_ADDRESS;

    if (!contractAddress) {
      return {
        success: false,
        message: 'Mixer contract not configured',
        error: 'CONFIG_ERROR'
      };
    }

    // Parse the mixer note - expecting mixer_<base64(JSON)>
    let noteData: { nullifier: string; secret: string; commitment: string; leafIndex: number };

    try {
      // Remove "mixer_" prefix and decode base64 JSON
      const encoded = mixerNote.replace('mixer_', '');
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      noteData = JSON.parse(decoded);

      if (!noteData.nullifier || !noteData.secret || noteData.leafIndex === undefined) {
        throw new Error('Invalid note format');
      }
    } catch (parseError) {
      return {
        success: false,
        message: `Invalid mixer note format.\n\nExpected format: mixer_<encoded_note>\n\nThe note was provided when you made your deposit. Make sure you saved it!`,
        error: 'INVALID_NOTE'
      };
    }

    // Reconstruct the DepositNote
    const note = {
      nullifier: noteData.nullifier,
      secret: noteData.secret,
      commitment: noteData.commitment,
      nullifierHash: ethers.keccak256(
        ethers.solidityPacked(['bytes32', 'bytes32'], [noteData.nullifier, noteData.nullifier])
      ),
    };

    // Generate the withdrawal proof
    const withdrawProof = mixerService.generateWithdrawProof(
      note,
      noteData.leafIndex,
      userAddress, // recipient = user's address
      ethers.ZeroAddress, // no relayer
      '0' // no fee
    );

    // Create withdrawal info for frontend
    const withdrawInfo = {
      contract: contractAddress,
      method: 'withdraw',
      params: {
        proof: withdrawProof.proof,
        root: withdrawProof.root,
        nullifierHash: withdrawProof.nullifierHash,
        recipient: userAddress,
        relayer: ethers.ZeroAddress,
        fee: '0'
      }
    };

    // Send notification
    await createNotification(userId, {
      type: NotificationType.MIXER_WITHDRAW_READY,
      title: '🎭 Mixer Withdrawal Ready',
      message: `Sign the transaction to withdraw ${mixerService.getDenomination()} CRO anonymously`,
      priority: 'high',
      data: { withdrawInfo },
      actions: [
        { label: 'Sign Withdrawal', command: 'SIGN_TX', style: 'primary' }
      ]
    });

    const response = formatMixerWithdrawResponse(withdrawInfo, mixerService.getDenomination());

    return {
      success: true,
      message: response,
      data: {
        withdrawInfo,
        requiresSignature: true
      }
    };
  } catch (error) {
    server.log.error({ error }, 'Mixer withdrawal error');
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Mixer withdrawal failed',
      error: 'MIXER_ERROR'
    };
  }
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
    await createNotification(userId, {
      type: NotificationType.MIXER_DEPOSIT_READY,
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
      ]
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
    const walletService = getWalletService();
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

/**
 * /cancel <intentId>
 * Cancel a pending payment intent
 */
async function executeCancel(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  const intentId = args[0];

  // Get intent
  const intent = intentService.getById(intentId);
  if (!intent) {
    return {
      success: false,
      message: `❌ Intent ${intentId} not found`,
      error: 'INTENT_NOT_FOUND'
    };
  }

  // Verify ownership
  if (intent.owner && intent.owner !== userAddress) {
    return {
      success: false,
      message: '❌ You do not own this intent',
      error: 'UNAUTHORIZED'
    };
  }

  // Check if can be cancelled
  if (intent.status === 'executed') {
    return {
      success: false,
      message: `❌ Cannot cancel intent - already executed\n\nIntent: ${intentId}\nStatus: ${intent.status}`,
      error: 'CANNOT_CANCEL'
    };
  }

  if (intent.status === 'funded') {
    return {
      success: false,
      message: `❌ Cannot cancel intent - already funded\n\nIntent: ${intentId}\nStatus: ${intent.status}\n\n⚠️ Funded intents require contract interaction to cancel.`,
      error: 'CANNOT_CANCEL'
    };
  }

  if (intent.status === 'cancelled') {
    return {
      success: false,
      message: `⚠️ Intent already cancelled\n\nIntent: ${intentId}`,
      error: 'ALREADY_CANCELLED'
    };
  }

  // Cancel the intent
  const cancelled = intentService.cancel(intentId);

  if (!cancelled) {
    return {
      success: false,
      message: `❌ Failed to cancel intent ${intentId}`,
      error: 'CANCEL_FAILED'
    };
  }

  // Send notification
  await createNotification(userId, {
    type: NotificationType.INTENT_FAILED,
    title: '❌ Intent Cancelled',
    message: `Intent ${intentId.slice(0, 8)}... has been cancelled`,
    priority: 'medium',
    data: { intentId, status: 'cancelled' }
  });

  const response = formatCancelResponse(intent);

  return {
    success: true,
    message: response,
    data: {
      intentId,
      previousStatus: intent.status,
      newStatus: 'cancelled'
    }
  };
}

/**
 * /bulk <subcommand> [batchId] [data]
 * Manage bulk payment batches
 */
async function executeBulk(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  args: string[]
): Promise<CommandExecutionResult> {
  const subcommand = args[0];
  const batchId = args[1];

  switch (subcommand) {
    case 'upload':
      return await executeBulkUpload(server, userId, userAddress);

    case 'preview':
      return await executeBulkPreview(server, userId, userAddress, batchId);

    case 'execute':
      return await executeBulkExecute(server, userId, userAddress, batchId);

    case 'status':
      return await executeBulkStatus(server, userId, userAddress, batchId);

    default:
      return {
        success: false,
        message: `Unknown bulk subcommand: ${subcommand}\n\nAvailable subcommands:\n• upload - Start bulk payment upload\n• preview <batchId> - Preview batch\n• execute <batchId> - Execute batch\n• status <batchId> - Check batch status`,
        error: 'INVALID_SUBCOMMAND'
      };
  }
}

/**
 * /bulk upload
 * Start bulk payment upload process
 */
async function executeBulkUpload(
  server: FastifyInstance,
  userId: string,
  userAddress: string
): Promise<CommandExecutionResult> {
  // Generate a new batch ID
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Send notification with upload instructions
  await createNotification(userId, {
    type: NotificationType.INTENT_CREATED,
    title: '📦 Bulk Upload Ready',
    message: 'Upload your CSV or JSON file to continue',
    priority: 'medium',
    data: { batchId, status: 'awaiting_upload' },
    actions: [
      { label: 'Upload CSV', command: 'UPLOAD_CSV', style: 'primary' },
      { label: 'Upload JSON', command: 'UPLOAD_JSON', style: 'secondary' }
    ]
  });

  const response = formatBulkUploadResponse(batchId);

  return {
    success: true,
    message: response,
    data: {
      batchId,
      status: 'awaiting_upload',
      supportedFormats: ['csv', 'json']
    }
  };
}

/**
 * /bulk preview <batchId>
 * Preview a bulk payment batch
 */
async function executeBulkPreview(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  batchId: string
): Promise<CommandExecutionResult> {
  // In a full implementation, this would fetch the batch from database
  // For now, return a placeholder showing the feature is active

  if (!batchId) {
    return {
      success: false,
      message: 'Usage: /bulk preview <batchId>',
      error: 'MISSING_BATCH_ID'
    };
  }

  // Placeholder response until batch storage is implemented
  const response = formatBulkPreviewResponse(batchId, []);

  return {
    success: true,
    message: response,
    data: {
      batchId,
      status: 'preview',
      payments: []
    }
  };
}

/**
 * /bulk execute <batchId>
 * Execute a bulk payment batch
 */
async function executeBulkExecute(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  batchId: string
): Promise<CommandExecutionResult> {
  if (!batchId) {
    return {
      success: false,
      message: 'Usage: /bulk execute <batchId>',
      error: 'MISSING_BATCH_ID'
    };
  }

  // In a full implementation, this would:
  // 1. Validate the batch exists and belongs to user
  // 2. Create intents for each payment
  // 3. Return deposit instructions

  await createNotification(userId, {
    type: NotificationType.TRANSACTION_PENDING,
    title: '📦 Bulk Execution Started',
    message: `Batch ${batchId.slice(0, 12)}... is being processed`,
    priority: 'high',
    data: { batchId, status: 'executing' }
  });

  const response = formatBulkExecuteResponse(batchId);

  return {
    success: true,
    message: response,
    data: {
      batchId,
      status: 'executing'
    }
  };
}

/**
 * /bulk status <batchId>
 * Check bulk payment batch status
 */
async function executeBulkStatus(
  server: FastifyInstance,
  userId: string,
  userAddress: string,
  batchId: string
): Promise<CommandExecutionResult> {
  if (!batchId) {
    return {
      success: false,
      message: 'Usage: /bulk status <batchId>',
      error: 'MISSING_BATCH_ID'
    };
  }

  // In a full implementation, this would fetch real batch status
  const response = formatBulkStatusResponse(batchId, 'pending', 0, 0);

  return {
    success: true,
    message: response,
    data: {
      batchId,
      status: 'pending',
      completed: 0,
      total: 0
    }
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
Recipient: ${intent.recipient}

⚠️ Please sign the transaction in your wallet to deposit funds.
Once confirmed, the payment will be automatically executed.`;
}

function formatMixerDepositResponse(note: any, depositInfo: any): string {
  // Create an encoded note for easy withdrawal
  // leafIndex will be set after deposit confirmation (for now use 0, user should check)
  const noteForWithdraw = {
    nullifier: note.nullifier,
    secret: note.secret,
    commitment: note.commitment,
    leafIndex: 0 // Will be updated after deposit confirmation
  };
  const encodedNote = 'mixer_' + Buffer.from(JSON.stringify(noteForWithdraw)).toString('base64');

  return `🎭 Privacy Mixer Deposit
━━━━━━━━━━━━━━━━━━━━━━━
Amount: ${depositInfo.amount} CRO
Contract: ${depositInfo.contract}

⚠️⚠️⚠️ CRITICAL - SAVE THIS NOTE! ⚠️⚠️⚠️

Commitment: ${note.commitment}
Nullifier: ${note.nullifier}
Secret: ${note.secret}

📋 Withdrawal Note (COPY THIS!):
${encodedNote}

⚠️ If you lose this note, your funds CANNOT be recovered!

To withdraw, use:
/withdraw ${encodedNote}`;
}

function formatMixerWithdrawResponse(withdrawInfo: any, denomination: string): string {
  return `🎭 Privacy Mixer Withdrawal
━━━━━━━━━━━━━━━━━━━━━━━
Amount: ${denomination} CRO
Contract: ${withdrawInfo.contract}
Recipient: ${withdrawInfo.params.recipient}

✅ Withdrawal proof generated!

⚠️ Please sign the transaction to withdraw your funds anonymously.
After confirmation, the funds will be sent to your wallet.`;
}

function formatIntentStatusResponse(intent: any): string {
  const statusEmojiMap: Record<string, string> = {
    pending: '⏸️',
    funded: '✅',
    executed: '✅',
    failed: '❌',
    cancelled: '🚫'
  };
  const statusEmoji = statusEmojiMap[intent.status] || '❓';

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

  const statusEmojiMap: Record<string, string> = {
    pending: '⏸️',
    funded: '💰',
    executed: '✅',
    failed: '❌',
    cancelled: '🚫'
  };

  intents.forEach(intent => {
    const statusEmoji = statusEmojiMap[intent.status] || '❓';
    const date = new Date(intent.createdAt).toLocaleDateString();
    lines.push(`${statusEmoji} ${intent.amount} ${intent.currency} → ${intent.recipient.slice(0, 10)}...`);
    lines.push(`   ${date} | ${intent.intentId}`);
  });

  lines.push('\nType /status <intentId> for details');

  return lines.join('\n');
}

function formatCancelResponse(intent: any): string {
  return `❌ Intent Cancelled
━━━━━━━━━━━━━━━━━━━━━━━
Intent: ${intent.intentId}
Recipient: ${intent.recipient}
Amount: ${intent.amount} ${intent.currency}
Previous Status: ${intent.status}

✅ The payment intent has been cancelled successfully.
No funds were transferred.

📋 Next steps:
Command: /history
Command: /pay ${intent.recipient} ${intent.amount} ${intent.currency}`;
}

function formatBulkUploadResponse(batchId: string): string {
  return `📦 Bulk Payment Upload
━━━━━━━━━━━━━━━━━━━━━━━
Batch: ${batchId}
Status: Awaiting Upload

📋 Supported Formats:
• CSV - recipient,amount,currency
• JSON - [{ recipient, amount, currency }]

📄 CSV Example:
recipient,amount,currency
0x742d35Cc6634C0532925a3b844Bc9e7595f39dF4,100,CRO
0x8a3e47Bf1234567890abcdef1234567890abcdef,50,USDC

⏳ After uploading your file, run:
Command: /bulk preview ${batchId}`;
}

function formatBulkPreviewResponse(batchId: string, payments: any[]): string {
  if (payments.length === 0) {
    return `📦 Bulk Payment Preview
━━━━━━━━━━━━━━━━━━━━━━━
Batch: ${batchId}
Status: No payments found

⚠️ This batch has no payments yet.
Please upload a CSV or JSON file first.

Command: /bulk upload`;
  }

  const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const lines = [
    `📦 Bulk Payment Preview`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `Batch: ${batchId}`,
    `Total Payments: ${payments.length}`,
    `Total Amount: ${totalAmount}`,
    ``,
    `📋 Payments:`,
  ];

  payments.slice(0, 5).forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p.recipient.slice(0, 10)}... → ${p.amount} ${p.currency}`);
  });

  if (payments.length > 5) {
    lines.push(`  ... and ${payments.length - 5} more`);
  }

  lines.push(`\n✅ Ready to execute:`);
  lines.push(`Command: /bulk execute ${batchId}`);

  return lines.join('\n');
}

function formatBulkExecuteResponse(batchId: string): string {
  return `📦 Bulk Payment Execution
━━━━━━━━━━━━━━━━━━━━━━━
Batch: ${batchId}
Status: Processing

⏳ Creating payment intents for all recipients...

You will be notified when all payments are ready.

📋 Check progress:
Command: /bulk status ${batchId}`;
}

function formatBulkStatusResponse(batchId: string, status: string, completed: number, total: number): string {
  const statusEmoji = {
    pending: '⏸️',
    processing: '⏳',
    completed: '✅',
    failed: '❌',
    partial: '⚠️'
  }[status] || '❓';

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  let nextSteps = '';
  if (status === 'completed') {
    nextSteps = `\n✅ All payments have been processed!\n\n📋 View history:\nCommand: /history`;
  } else if (status === 'pending') {
    nextSteps = `\n⏳ Waiting for execution.\n\n📋 Execute batch:\nCommand: /bulk execute ${batchId}`;
  } else if (status === 'processing') {
    nextSteps = `\n⏳ Payments are being processed...`;
  } else if (status === 'failed' || status === 'partial') {
    nextSteps = `\n⚠️ Some payments may have failed.\n\n📋 View details:\nCommand: /history`;
  }

  return `📦 Bulk Payment Status
━━━━━━━━━━━━━━━━━━━━━━━
Batch: ${batchId}
Status: ${statusEmoji} ${status}
Progress: ${completed}/${total} (${progress}%)
${nextSteps}`;
}
