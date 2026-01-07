import Sidebar from "./components/Sidebar"
import Page from "./components/Page"

export default function App() {
  return (
    <div className="flex h-screen bg-neutral-100 text-neutral-900">
      <Sidebar />
      <Page />
    </div>
  )
}
