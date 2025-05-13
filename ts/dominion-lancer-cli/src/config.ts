export const config = {
  devnet: {
    runner: {
      package:
        "0xf5d1ac000f1ef52d8c2ffc9f49a0d21213e368ac13d862328b2f060c4841ff3c",
      adminCap:
        "0x8f3140fec800fef32a87496ddece86f3f00d1830562b3145d2ea6e1ff83aa880",
      upgradeCap:
        "0x17b39fdc5723a2b5d1a15feca95feb0f3dd17e4aac3e9da6cbeeca120faf5428",
      server: {
        object:
          "0xb0fa62abd2fb667d9e714fb10edc7e1d163c1535edb5e2fcc590db303f94b026",
        url: "http://localhost:9200",
      },
    },
    lancer: {
      package:
        "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
      upgradeCap:
        "0x59b77556478a58821f872512fb9ea1e92553390142c728be8a7ffcc093ef14da",
      typeOrigins: {
        bugBounty: {
          BugBounty:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
          BugBountyV1:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
          OwnerCap:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
          BugBountyCreatedEvent:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
          BugBountyApprovedEvent:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
        },
        executor: {
          EXECUTOR:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
        },
        finding: {
          FindingCreatedEvent:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
          Finding:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
          FindingV1:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
          OwnerCap:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
          VerifyExecutorMessage:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
        },
        upgraderApprove: {
          UpgraderApproveV1:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
        },
        payment: {
          PaymentV1:
            "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
        },
      },
    },
    walrus: {
      package:
        "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
    },
    nautilus: {
      package:
        "0x154b56e06f699cf6de7d38addcea611efb2c6de3debda72a59a10772590cc222",
    },
  },
};

export type Network = keyof typeof config;
export const networks = Object.keys(config) as unknown as [
  Network,
  ...Network[]
];
export type Config = (typeof config)[Network];
