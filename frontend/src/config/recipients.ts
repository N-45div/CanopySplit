export type RecipientRole = 'Planters' | 'MRV' | 'Maintenance';

export const RECIPIENTS: Record<string, { name: string; role: RecipientRole; url: string; logo?: string }> = {
  // Planters
  '0xf9b2efcacc1b93c1bd7f898d0a8c4b34abd78e53': {
    name: 'Planters',
    role: 'Planters',
    url: 'https://sepolia.etherscan.io/address/0xF9b2eFCAcc1B93c1bd7F898d0a8c4b34aBD78E53',
    logo: '/logos/planters.svg',
  },
  // MRV
  '0x9261432cab3c0f83e86fa6e41e4a88da06e7ecc6': {
    name: 'MRV',
    role: 'MRV',
    url: 'https://sepolia.etherscan.io/address/0x9261432cab3c0F83E86fa6e41E4a88dA06E7ecc6',
    logo: '/logos/mrv.svg',
  },
  // Maintenance
  '0x89c13e8e5a81e775160322df9d7869893926a8cc': {
    name: 'Maintenance',
    role: 'Maintenance',
    url: 'https://sepolia.etherscan.io/address/0x89C13e8e5a81E775160322df9d7869893926A8Cc',
    logo: '/logos/maintenance.svg',
  },
};

export function getRecipientMeta(addr?: string) {
  if (!addr) return undefined;
  return RECIPIENTS[addr.toLowerCase()];
}
