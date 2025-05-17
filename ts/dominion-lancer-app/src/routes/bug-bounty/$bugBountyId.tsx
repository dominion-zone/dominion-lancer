import { createFileRoute } from '@tanstack/solid-router'
import BugBountyCard from '~/components/bugBounty/index/BugBountyCard';

export const Route = createFileRoute('/bug-bounty/$bugBountyId')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams();
  return (
    <main>
      <BugBountyCard bugBountyId={params().bugBountyId} solo/>
    </main>
  );
}
