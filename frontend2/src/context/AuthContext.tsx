import { IUser } from "@/types/auth";
import { createContext, useContext, useEffect, useState } from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { storage } from "@/utils/storage";

export interface IAuthContext {
    user: IUser | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, username: string) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<IAuthContext | null>(null);

export const AuthProvider = ({children}: {children: React.ReactNode}) => {
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(true);

    const {data: user, isLoading: isUserLoading} = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const userInfo = storage.getUser();
            if (!userInfo) return null;
            
            // setAuthToken(token);
            const { data } = await api.get('/auth/check-auth');
            console.log("hello data", data)
            return data;
        },
        retry: false,
    });


    useEffect(() => {
        setIsLoading(isUserLoading);
    }, [isUserLoading]);

    const loginHandler = async (email: string, password: string) => {
        const { data } = await api.post('/auth/login', { email, password });
        storage.setUser(data);
        // setAuthToken(data.token);

        // queryClient.setQueryData(['user'], data.user);
        await queryClient.invalidateQueries({ queryKey: ['user'] });
    };

    const registerHandler = async (email: string, password: string, username: string) => {
        await api.post('/auth/register', {username, email, password});
    };

    const logoutHandler = async () => {
        await api.get('/auth/logout');
        storage.clearUser();
        // setAuthToken('');
        
        queryClient.setQueryData(['user'], null);
        queryClient.clear();
    };


    return (
        <AuthContext.Provider value={{
            user,
            login: loginHandler,
            register: registerHandler,
            logout: logoutHandler,
            isLoading,
            isAuthenticated: !!user,
        }}>
            {children}
        </AuthContext.Provider>
    );
}


export const useAuth = () => {
    const context = useContext(AuthContext);

    if(!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    };

    return context;
}
