import { useSuiNetwork } from "~/contexts";

const config = {
  devnet: {
    runner: {
      package:
        "0x83ea0f3f23a80398cdd2a2f24fd2b0da053c5e316154945266c9a8921d144628",
      adminCap:
        "0x300f23ca09695ea4621c803ce47bc820bb2d0cf6741f96e689470372f163bf21",
      upgradeCap:
        "0xaba1b0fae235836e89c8eb1f3596cf52e4d034b152c1cc39452fbe40d3ba5dd5",
      server: {
        object:
          "0x4d8e56c1e2ac86f654947c53c44418b12fa9922a1d4fee337e27a59ed2674d18",
        url: "http://localhost:9200",
      },
    },
    // 5ujKZG9TFyAUiPNtZqP5BYCitwuAsNTCqecPp1W68nKT
    lancer: {
      package:
        "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
      upgradeCap:
        "0xbdc579bd0e1ec573889eebbe19b7a5e9c2d991d21556249737ca4c815bd7b623",
      typeOrigins: {
        bugBounty: {
          BugBounty:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
          BugBountyV1:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
          OwnerCap:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
          BugBountyCreatedEvent:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
          BugBountyApprovedEvent:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
        },
        executor: {
          EXECUTOR:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
        },
        finding: {
          FindingCreatedEvent:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
          Finding:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
          FindingV1:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
          OwnerCap:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
          VerifyExecutorMessage:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
        },
        upgraderApprove: {
          UpgraderApproveV1:
            "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
        },
      },
    },
    walrus: {
      package:
        "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
    },
    nautilus: {
      package:
        "0x27265d40c15f3123d8823eee1d1d1f34b168f44e8d16b1b077157127ea3b6339",
    },
  },
};

export type Network = keyof typeof config;
export const networks = Object.keys(config) as unknown as [
  Network,
  ...Network[]
];
export type Config = (typeof config)[Network];

export const useConfig = (network?: Network) => {
  if (!network) {
    network = useSuiNetwork().value as Network;
  }
  return config[network];
};
