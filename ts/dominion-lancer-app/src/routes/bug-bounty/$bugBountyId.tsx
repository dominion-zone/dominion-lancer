import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/bug-bounty/$bugBountyId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/bug-bounty/$bugBountyId"!</div>
}
