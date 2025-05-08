import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/docs')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/docs"!</div>
}
