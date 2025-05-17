import { createFileRoute } from "@tanstack/solid-router";
import FindingCard from "~/components/finding/index/FindingCard";

export const Route = createFileRoute("/finding/$findingId")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  return (
    <main>
      <FindingCard findingId={params().findingId} solo/>
    </main>
  );
}
