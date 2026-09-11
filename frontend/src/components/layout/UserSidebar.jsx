import { NavLink, useNavigate } from "react-router-dom"; 

import { 
  LayoutDashboard, 
  UserCircle, 
  FileText, 
  BriefcaseBusiness, 
  Bookmark, 
  Target, 
  ClipboardList, 
  Settings, 
  LogOut, 
  Sparkles, 
  MessageCircle,
} from "lucide-react"; 

import "../../styles/UserSidebar.css"; 

function UserSidebar() { 
  const navigate = useNavigate(); 

  const menuItems = [ 
    { 
      name: "Dashboard", 
      path: "/userDashboard", 
      icon: LayoutDashboard, 
      iconClass: "icon-dashboard", 
    }, 

    { 
      name: "Profile", 
      path: "/profile", 
      icon: UserCircle, 
      iconClass: "icon-profile", 
    }, 

    { 
      name: "Resume", 
      path: "/resume", 
      icon: FileText, 
      iconClass: "icon-resume", 
    }, 

    { 
      name: "Preparation Agent", 
      path: "/preparation-agent", 
      icon: Sparkles, 
      iconClass: "icon-preparation", 
    }, 

    { 
      name: "Preparation Chat", 
      path: "/preparation-chat", 
      icon: MessageCircle, 
      iconClass: "icon-preparation-chat", 
    }, 

    { 
      name: "Internships", 
      path: "/internships", 
      icon: BriefcaseBusiness, 
      iconClass: "icon-internships", 
    }, 

    { 
      name: "Saved Internships", 
      path: "/saved-internships", 
      icon: Bookmark, 
      iconClass: "icon-saved", 
    }, 

    { 
      name: "Skill Gap", 
      path: "/skill-gap", 
      icon: Target, 
      iconClass: "icon-skill-gap", 
    }, 

    { 
      name: "Applications", 
      path: "/applications", 
      icon: ClipboardList, 
      iconClass: "icon-applications", 
    }, 

    { 
      name: "Settings", 
      path: "/settings", 
      icon: Settings, 
      iconClass: "icon-settings", 
    }, 

    { 
      name: "Logout", 
      path: "/", 
      icon: LogOut, 
      iconClass: "icon-logout", 
      logout: true, 
    }, 
  ]; 

  const handleLogout = (event) => { 
    event.preventDefault(); 
    localStorage.removeItem("access_token"); 
    localStorage.removeItem("user"); 
    localStorage.removeItem("dashboard_type"); 
    navigate("/", { 
      replace: true, 
    }); 
  }; 

  return ( 
    <div className="user-sidebar-inner"> 

      <div className="sidebar-logo"> 
        <img src="/logo.png" alt="InternMatchAI" /> 
      </div> 

      <nav className="sidebar-navigation"> 
        {menuItems.map((item) => { 
          const Icon = item.icon; 

          return ( 
            <NavLink 
              key={item.name} 
              to={item.path} 
              title={item.name} 
              onClick={item.logout ? handleLogout : undefined} 
              className={({ isActive }) => 
                `sidebar-nav-item ${isActive ? "active" : ""} ${ 
                  item.logout ? "sidebar-logout" : "" 
                }` 
              } 
            > 

              <span className={`sidebar-nav-icon ${item.iconClass}`}> 
                <Icon size={21} strokeWidth={2.2} /> 
              </span> 

              <span className="sidebar-nav-text">{item.name}</span> 

              {!item.logout && <span className="sidebar-active-indicator" />} 
            </NavLink> 
          ); 
        })} 
      </nav> 
    </div> 
  ); 
} 

export default UserSidebar; 
