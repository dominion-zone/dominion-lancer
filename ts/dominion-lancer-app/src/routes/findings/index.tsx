import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/findings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/findings/"!</div>
}
