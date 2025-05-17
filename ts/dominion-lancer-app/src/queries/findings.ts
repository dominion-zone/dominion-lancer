import { useQueries } from "@tanstack/solid-query";
import { Network } from "~/stores/config";
import { queryClient } from "./client";
import { Accessor, createMemo } from "solid-js";
import { Finding } from "~/sdk/Finding";
import { useFindingIds } from "./findingIds";
import { findingOptions } from "./finding";

export type FindingsProps = {
  network: Network;
  ownedBy?: string;
  filter?: (_: Finding) => boolean;
};

export const useFindings = (props: Accessor<FindingsProps>) => {
  const ids = useFindingIds(props);
  const findings = useQueries(() => ({
    queries: (ids.data || []).map((id) =>
      findingOptions({ ...props(), findingId: id })
    ),
    queryClient,
  }));
  const filtered = createMemo(() => {
    const filter = props().filter;
    return findings
      .map((finding) => finding.data)
      .filter((data) => data && (!filter || filter(data))) as Finding[];
  });
  return {
    ids,
    findings,
    filtered,
  };
};
