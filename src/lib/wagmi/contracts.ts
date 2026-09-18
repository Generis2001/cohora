import { type Address } from 'viem';

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x0') as Address;
export const PAYMENT_ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS ?? '0x0') as Address;
export const TREASURY_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS ?? '0x0') as Address;
export const SUBSCRIPTION_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS ?? '0x0') as Address;
export const PLATFORM_WALLET = (process.env.NEXT_PUBLIC_PLATFORM_WALLET ?? '0x0986Bfd653985c9Fa60a464784264444B542BfD7') as Address;
export const LISTING_FEE_UNITS = 100_000n; // 0.10 USDC (10 cents, 6 decimals)

export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const PAYMENT_ROUTER_ABI = [
  {
    name: 'pay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'paymentId', type: 'bytes32' },
      { name: 'creator', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'paymentType', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'platformFeeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'processedPayments',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'paymentId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'PaymentReceived',
    type: 'event',
    inputs: [
      { name: 'paymentId', type: 'bytes32', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'grossAmount', type: 'uint256', indexed: false },
      { name: 'platformFee', type: 'uint256', indexed: false },
      { name: 'netAmount', type: 'uint256', indexed: false },
      { name: 'paymentType', type: 'uint8', indexed: false },
    ],
  },
] as const;

export const TREASURY_VAULT_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'creator', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'creator', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'Deposited',
    type: 'event',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'newBalance', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Withdrawn',
    type: 'event',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const SUBSCRIPTION_MANAGER_ABI = [
  {
    name: 'isSubscribed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'subscriber', type: 'address' },
      { name: 'tierId', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'subscriptions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subId', type: 'bytes32' }],
    outputs: [
      { name: 'subscriber', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'tierId', type: 'bytes32' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'currentPeriodEnd', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    name: 'cancelSubscription',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'SubscriptionCreated',
    type: 'event',
    inputs: [
      { name: 'subId', type: 'bytes32', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'tierId', type: 'bytes32', indexed: false },
      { name: 'periodEnd', type: 'uint256', indexed: false },
    ],
  },
] as const;
