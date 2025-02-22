import { createFileRoute } from '@tanstack/react-router'
import { Button } from "@/components/ui/button"


export const Route = createFileRoute('/')({
  component: Index,
})


function Index() {
  return (
    <div className="p-2">
      <h3 className="bg-sky-50">Welcome Home!</h3>
      <Button variant="outline">Click me</Button>
    </div>
  )
}