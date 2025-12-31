/** @type {import('next').NextConfig} */
const nextConfig = {
  // Webpack configuration to handle React Native dependencies
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Ignore React Native modules in browser environment
      'react-native': false,
      '@react-native-async-storage/async-storage': false,
    };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      'react-native': false,
      '@react-native-async-storage/async-storage': false,
    };

    // Ignore specific problematic modules from MetaMask SDK
    config.externals = [
      ...Object.keys(config.externals || {}),
      'react-native',
      '@react-native-async-storage/async-storage',
    ].filter((name, index, array) => array.indexOf(name) === index);

    // Suppress false warnings for optional dependencies
    const originalExternalsFunction = config.externalsPresets
      ? config.externalsPresets.node
      : null;

    return config;
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID:
      process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || '338',
  },

  // Suppress build warnings for optional dependencies
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  // Experimental features for better build
  experimental: {
    // Optimize package imports if needed
  },
};

module.exports = nextConfig;
