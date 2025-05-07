export const config = {
  devnet: {
    runner: {
      package: '0x83ea0f3f23a80398cdd2a2f24fd2b0da053c5e316154945266c9a8921d144628',
      adminCap: '0x300f23ca09695ea4621c803ce47bc820bb2d0cf6741f96e689470372f163bf21',
      upgradeCap: '0xaba1b0fae235836e89c8eb1f3596cf52e4d034b152c1cc39452fbe40d3ba5dd5',
      server: {
        object: '0x4d8e56c1e2ac86f654947c53c44418b12fa9922a1d4fee337e27a59ed2674d18',
        url: "http://localhost:9200",
      }
    },
    lancer: {
      package: '0x26e6be0dfebb91555bcd3633cfe083dcd45f4efc71715a80d34266210437f698',
      upgradeCap: '0xcf92fa15b535c230b3aad3ff80910537ba5859344293a3af338bd27c19ff2aa1',
    },
    walrus: {
      package: '0x26e6be0dfebb91555bcd3633cfe083dcd45f4efc71715a80d34266210437f698',
    },
    nautilus: {
      package: '0x26e6be0dfebb91555bcd3633cfe083dcd45f4efc71715a80d34266210437f698',
    }
  }
};

export type Network = keyof typeof config;
export const networks = Object.keys(config) as unknown as [Network, ...Network[]];

