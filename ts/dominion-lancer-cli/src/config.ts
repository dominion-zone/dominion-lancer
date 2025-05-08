export const config = {
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
    // 8KYuqLib5eBtcRN8Q8KExExigsivv4yZoNRcR6rXKARt
    lancer: {
      package:
        "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
      upgradeCap:
        "0x6689a153e74f63f67c4d4415753acd784af99aa0de995ffd50c632d588dd5612",
      typeOrigins: {
        bugBounty: {
          BugBounty:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
          BugBountyV1:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
          OwnerCap:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
          BugBountyCreatedEvent:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
          BugBountyApprovedEvent:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
        },
        executor: {
          EXECUTOR:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
        },
        finding: {
          Finding:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
          FindingV1:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
          OwnerCap:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
          VerifyExecutorMessage:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
        },
        upgraderApprove: {
          UpgraderApproveV1:
            "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
        },
      },
    },
    walrus: {
      package:
        "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
    },
    nautilus: {
      package:
        "0x2ca0197cd152f9821ac46b0b96450765470c060b2ba332c9a49a7f61e54dd13f",
    },
  },
};

export type Network = keyof typeof config;
export const networks = Object.keys(config) as unknown as [
  Network,
  ...Network[]
];
export type Config = (typeof config)[Network];
