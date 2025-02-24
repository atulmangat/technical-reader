import { IUser } from "@/types/auth";

const STORAGE_USER_KEY = "user";

export const storage = {
  getUser: () =>
    window.localStorage.getItem(STORAGE_USER_KEY)
      ? JSON.parse(window.localStorage.getItem(STORAGE_USER_KEY) as string)
      : null,
  setUser: (user: IUser) =>
    window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user)),
  clearUser: () => window.localStorage.removeItem(STORAGE_USER_KEY),
};
