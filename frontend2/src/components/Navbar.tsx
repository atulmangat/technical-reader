import { useAuth } from "@/context/AuthContext";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";


export const Navbar = () => {
    const {user, logout, isAuthenticated} = useAuth();
    console.log("isAuthenticated", isAuthenticated, "user", user);


    const handleLogout = async () => {
        try {
            await logout();
            toast.success(
               'Logged out successfully',{
                duration: 2000,
            });
        } catch (error){
            toast.error(
                'Failed to logout',{
                duration: 2000,
            });
        }
    };

    return (
        <nav className="bg-white shadow">
            <div className="container mx-auto px-4">
                <div className="flex justify-between h-16 items-center">
                    <Link to="/" className="text-xl font-bold">
                    Home
                    </Link>

                    <div className="flex items-center gap-4">
                        {isAuthenticated ? (<>
                        <span className="text-gray-700">Welcome, {user?.username}</span>
                        <Button variant="outline" onClick={handleLogout}>Logout</Button></>): 
                        (<>
                        <Link to="/login">
                        <Button>Login</Button>
                        </Link>
                        </>)}
                    </div>
                </div>
            </div>
        </nav>
    );
};


