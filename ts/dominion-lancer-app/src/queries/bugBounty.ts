import { Network } from "~/stores/config";
import { Accessor, createMemo, untrack } from "solid-js";
import { useSuiObject } from "./suiObject";
import { MoveStruct } from "@mysten/sui/client";
import { deriveDynamicFieldID } from "@mysten/sui/utils";
import { bcs } from "@mysten/sui/bcs";
import { useSuiDynamicFields } from "./suiDynamicFields";
import { BugBounty } from "~/sdk/BugBounty";

export type BugBountyProps = {
  network: Network;
  bugBountyId?: string;
};

export const useBugBounty = (props: BugBountyProps) =>
  untrack(() => {
    const outer = useSuiObject({
      get network() {
        return props.network;
      },
      get id() {
        return props.bugBountyId;
      },
    });

    const innerInfo = createMemo(() => {
      if (!outer.data) {
        return undefined;
      }

      const versioned = (
        (
          (outer.data.content! as { fields: MoveStruct }).fields as {
            inner: MoveStruct;
          }
        ).inner as { fields: MoveStruct }
      ).fields as {
        id: {
          id: string;
        };
        version: string;
      };

      const id = deriveDynamicFieldID(
        versioned.id.id,
        "u64",
        bcs.U64.serialize(versioned.version).toBytes()
      );

      return {
        id,
        version: versioned.version,
      };
    });

    const inner = useSuiObject({
      get network() {
        return props.network;
      },
      get id() {
        return innerInfo()?.id;
      },
    });

    const innerData = createMemo(() => {
      if (!inner.data) {
        return undefined;
      }
      return (
        (inner.data!.content as { fields: MoveStruct }).fields as {
          value: { fields: MoveStruct };
        }
      ).value.fields as {
        approves: {
          fields: {
            id: {
              id: string;
            };
          };
        };
        is_active: boolean;
        name: string;
        owner_cap_id: string;
        package_id: string;
      };
    });

    const ownerCap = useSuiObject({
      get network() {
        return props.network;
      },
      get id() {
        return innerData()?.owner_cap_id;
      },
    });

    const approves = useSuiDynamicFields({
      get network() {
        return props.network;
      },
      get parentId() {
        return innerData()?.approves.fields.id.id;
      },
    });

    const bugBounty: Accessor<BugBounty | null | undefined> = createMemo(() => {
      if (!props.bugBountyId) {
        return undefined;
      }
      if (outer.data === null) {
        return null;
      }
      const data = innerData();
      if (!data || !approves.data || !ownerCap.data) {
        return undefined;
      }

      return {
        id: props.bugBountyId,
        ownerCapId: data.owner_cap_id,
        packageId: data.package_id,
        name: data.name,
        isActive: data.is_active,
        approves: approves.data.map(
          (approve) => (approve.name.value as { name: string }).name
        ),
        owner:
          (ownerCap.data!.owner as { AddressOwner?: string }).AddressOwner ??
          null,
      };
    });

    return {
      get data() {
        return bugBounty();
      },
    };
  });
