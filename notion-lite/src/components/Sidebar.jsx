import { useState } from "react";

// import CloseIcon from "../assets/close.svg?react";
// import MenuIcon from "../assets/menu.svg?react";

import {
    CircleChevronRight,
    CircleChevronLeft,
    LayoutDashboard,
} from "lucide-react";

export default function Sidebar({ projectsList }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div
            className={`flex flex-col bg-rose-water text-rose-plum h-screen transition-all duration-300
      ${collapsed ? "w-fit" : "w-64"}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4">
                {!collapsed && <h2 className="text-lg main-header">Menu</h2>}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-rose-plum hover:text-rose-copper hover:bg-dark/30 rounded-3xl focus:outline-none p-2"
                >
                    {collapsed ? <CircleChevronRight /> : <CircleChevronLeft />}
                </button>
            </div>

            {/* Navigation */}
            {/* <nav className="flex-1 mt-4">
                {items.map((item) => (
                    <a
                        key={item.name}
                        href={item.href}
                        className="flex items-center py-2 px-4 hover:bg-dark/30 rounded"
                    >
                        {item.icon && <span className="mr-2">{item.icon}</span>}
                        {!collapsed && <span>{item.name}</span>}
                    </a>
                ))}
            </nav> */}

            {/* First we should have the important links like dashboard and maybe something at the bottom for the user profile */}
            <nav
                className={`flex flex-row ${
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
                                <item.icon className={`${!collapsed ? "mr-2" : ""}`} />
                            )}
                            {!collapsed && <span>{item.name}</span>}
                        </a>
                    ))
                    : ""}
            </nav>
        </div>
    );
}
