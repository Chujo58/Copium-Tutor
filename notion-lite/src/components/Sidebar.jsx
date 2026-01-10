import { useEffect, useState } from "react";
import { API_URL } from "../config";

// import CloseIcon from "../assets/close.svg?react";
// import MenuIcon from "../assets/menu.svg?react";

import {
    CircleChevronRight,
    CircleChevronLeft,
    LayoutDashboard,
} from "lucide-react";

export default function Sidebar({ projectsList }) {
    const [collapsed, setCollapsed] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [pfp, setPfp] = useState("");

    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_URL}/me`, {
                credentials: "include",
            });
            const data = await response.json();
            if (data.success) {
                setFirstName(data.user.fname);
                setLastName(data.user.lname);
                setPfp(data.user.pfp);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    }

    useEffect(() => {
        fetchUserProfile();
    }, []);

    return (
        <div
            className={`flex flex-col bg-rose-water text-rose-plum h-screen transition-all duration-300
      ${collapsed ? "w-fit" : "w-64"}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4">
                {!collapsed && <h2 className="text-xl font-card main-header">Menu</h2>}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-rose-plum hover:text-rose-copper hover:bg-dark/30 rounded-3xl focus:outline-none p-2"
                >
                    {collapsed ? <CircleChevronRight /> : <CircleChevronLeft />}
                </button>
            </div>
            {/* First we should have the important links like dashboard and maybe something at the bottom for the user profile */}
            <nav
                className={`flex flex-col h-full ${
                    collapsed ? "items-center p-4 justify-between" : "p-2"
                }`}
            >
                <a
                    key="dashboard"
                    href="/dashboard"
                    className={`flex items-center hover:bg-dark/30  ${
                        collapsed
                            ? "justify-center p-2 rounded-3xl hover:text-rose-copper"
                            : "w-full  rounded m-2"
                    }`}
                >
                    <LayoutDashboard
                        className={`${!collapsed ? "mr-2" : ""}`}
                    />
                    {!collapsed && <span>Dashboard</span>}
                </a>
                {/* Add a list of all the projects */}
                <div className="flex items-center justify-between p-2">
                    {!collapsed && (
                        <h2 className="main-header font-card">Projects</h2>
                    )}
                </div>
                {Array.isArray(projectsList) && projectsList.length > 0
                    ? projectsList.map((item) => (
                          <a
                              key={item.name}
                              href={item.href}
                              className={`flex items-center hover:bg-dark/30  ${
                                  collapsed
                                      ? "justify-center p-2 rounded-3xl hover:text-rose-copper"
                                      : "w-full  rounded m-2"
                              }`}
                          >
                              {item.icon && (
                                  <item.icon
                                      className={`${!collapsed ? "mr-2" : ""}`}
                                  />
                              )}
                              {!collapsed && <span>{item.name}</span>}
                          </a>
                      ))
                    : ""}
                {/* Now at the bottom, we should have the user profile */}
                <div className="mt-auto flex p-2">
                    {/* Circle profile picture */}
                    <img src={pfp} alt={`${firstName.charAt(0)} ${lastName.charAt(0)}`} className="rounded-full w-8 h-8 text-sm bg-dark text-accent text-center flex items-center justify-center main-header" />
                    {!collapsed && (
                        <div className="text-center flex items-center justify-center ml-4 font-card">
                            {`${firstName} ${lastName}`}
                        </div>
                    )}
                </div>
            </nav>
        </div>
    );
}
