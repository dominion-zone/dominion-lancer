import { useSuiNetwork } from "~/contexts";

const config = {
  devnet: {
    runner: {
      package:
        "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
      adminCap:
        "0xd8ce4ca8b9adc39a74687a065ee488d8b83fe87ddf891bdf6f46a206167436f4",
      upgradeCap:
        "0x8f5750c8fcdb5d4a69e4ea206edafef82049789f421b1d8e469776202c74ac3b",
      server: {
        object:
          "0xf6fb0011c0daf829b278ffafa034668a702ecde32e5f89a8ec6afa7a3973a2f3",
        operatorCap:
          "0x35509f24b81d9949a413d33228298231595c0019efc0a473dbe41f04c3f5f09d",
        url: "http://localhost:9200",
      },
      typeOrigins: {
        server: {
          AdminCap:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          OperatorCap:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          Server:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          ServerCreatedEvent:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          ServerDeactivatedEvent:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          ServerDestroyedEvent:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
        },
        escrow: {
          OwnerCap:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          Escrow:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          EscrowCreatedEvent:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          EscrowLockedEvent:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          EscrowUnlockedEvent:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          EscrowDestroyedEvent:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          EscrowDepositedEvent:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
          EscrowWithdrawnEvent:
            "0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820",
        },
      },
    },
    lancer: {
      package:
        "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
      upgradeCap:
        "0x7fc8d293736c2f613252f0497a64991932b7a79b6b70db52d68c7f9e40977caa",
      typeOrigins: {
        bugBounty: {
          BugBounty:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
          BugBountyV1:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
          OwnerCap:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
          BugBountyCreatedEvent:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
          BugBountyApprovedEvent:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
        },
        executor: {
          EXECUTOR:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
        },
        finding: {
          FindingCreatedEvent:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
          Finding:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
          FindingV1:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
          OwnerCap:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
          VerifyExecutorMessageV1:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
        },
        upgraderApprove: {
          UpgraderApproveV1:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
        },
        payment: {
          PaymentV1:
            "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
        },
      },
    },
    walrus: {
      package:
        "0xe98079b13784b6156c7e45f19a011c489d29cee30489c4986758b230408bd6f3",
    },
    nautilus: {
      package:
        "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
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
