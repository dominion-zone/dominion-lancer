import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/roadmap')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/roadmap"!</div>
}
