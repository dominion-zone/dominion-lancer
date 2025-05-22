import { useSuiNetwork } from "~/contexts";

const config = {
  testnet: {
    dummyPool: {
      package:
        "0xdd24951f0c8186acd8288da584d58833a5757167e014dc9bafcfa9c61c17a6fa",
      upgradeCap:
        "0x871fd3c66ebf503ee8b4bc9cd60706c8c816f37c6530fe0a92aa1638094bc72e",
    },
    lancer: {
      originalPackage: "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
      package:
        "0xb472abe6694550c624e46715a1aa9bdd1ad060bb50ee6ebccb068a9922d24d87",
      upgradeCap:
        "0xfc89f748d17f49cd81bf3cbabe99d65d5a9f56b964f9a295dc0a80aa46feb372",
      enclaveCap:
        "0xe663a75ef6835d074604aaf4f014715a7c68c52bb14e8bf62e4eea8043e6e688",
      typeOrigins: {
        bugBounty: {
          BugBounty:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
          BugBountyV1:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
          OwnerCap:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
          BugBountyCreatedEvent:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
          BugBountyApprovedEvent:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
        },
        executor: {
          EXECUTOR:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
        },
        finding: {
          FindingCreatedEvent:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
          Finding:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
          FindingV1:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
          OwnerCap:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
          VerifyExecutorMessageV1:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
        },
        upgraderApprove: {
          UpgraderApproveV1:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
        },
        payment: {
          PaymentV1:
            "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
        },
      },
    },
    runner: {
      package:
        "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
      adminCap:
        "0x531dd196e82e2ec23f5aa54142ec83f9bd7bf90b99c56a6320f0d7d91465547f",
      upgradeCap:
        "0xcb8fe0c4960e2207ae95ce98c7a91617375944a0cbfe4bc6fd0a283838f24721",
      server: {
        object:
          "0xf872c04363d282f8751c08f367349aa82ec0b85f38f9d0daa63b2c296f36575e",
        operatorCap:
          "0x08df34e5922df3f41a174f603f3c2e28b1461eb351ceccf64f6e0b27766926a9",
        url: "https://api.lancer.dominion.zone",
        // url: "http://localhost:9200",
      },
      typeOrigins: {
        server: {
          AdminCap:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          OperatorCap:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          Server:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          ServerCreatedEvent:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          ServerDeactivatedEvent:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          ServerDestroyedEvent:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
        },
        escrow: {
          OwnerCap:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          Escrow:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          EscrowCreatedEvent:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          EscrowLockedEvent:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          EscrowUnlockedEvent:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          EscrowDestroyedEvent:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          EscrowDepositedEvent:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
          EscrowWithdrawnEvent:
            "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
        },
      },
    },
  },
  /*
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
  */
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
