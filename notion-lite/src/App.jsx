import Sidebar from "./components/Sidebar"
import { UserDashboard, LandingPage } from "./components/Page"

export default function App() {
  return (
    <div className="flex h-screen bg-neutral-100 text-neutral-900">
      {/* <Sidebar collapsed={true} items={[{ name: "Dashboard", href: "#", icon: "🏠" },
    { name: "Projects", href: "#", icon: "📁" },
    { name: "Settings", href: "#", icon: "⚙️" },]} /> */}
      
      {/* <UserDashboard /> */}
      <LandingPage />
    </div>
  )
}
