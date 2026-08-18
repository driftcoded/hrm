export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokenData {
  accessToken: string;
  user: AuthUser;
}
