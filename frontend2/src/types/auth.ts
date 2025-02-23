export interface IUser {
  id: string;
  email: string;
  username: string;
}

export interface IAuthResponse {
  user: IUser;
  token: string;
}

export interface ILoginCredentials {
  email: string;
  password: string;
}

export interface IRegisterCredentials extends ILoginCredentials {
  username: string;
}
