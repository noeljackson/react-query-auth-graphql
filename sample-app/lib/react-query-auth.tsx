import React from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutateAsyncFunction,
  QueryObserverResult,
  RefetchOptions,
} from 'react-query';
import { Token } from './auth';
import { storage } from './utils';

export interface AuthProviderConfig<User = unknown, Error = unknown> {
  key?: string;
  tokenExpired: (token: any) => boolean;
  refreshFn: (data: any) => Promise<Token>;
  refreshExpired: (token: any) => boolean;
  refreshExpiredError: any;
  shouldRefreshOnBackground?: (token: Token) => boolean;
  loadUserFn: (data: any) => Promise<User>;
  loginFn: (data: any) => Promise<Token>;
  registerFn: (data: any) => Promise<Token>;
  logoutFn: () => Promise<any>;
  waitInitial?: boolean;
  LoaderComponent?: () => JSX.Element;
  ErrorComponent?: ({ error }: { error: Error | null }) => JSX.Element;
}

export interface AuthContextValue<
  User = unknown,
  Error = unknown,
  LoginCredentials = unknown,
  RegisterCredentials = unknown
> {
  user: User | undefined;
  login: UseMutateAsyncFunction<User, any, LoginCredentials>;
  logout: UseMutateAsyncFunction<any, any, void, any>;
  register: UseMutateAsyncFunction<User, any, RegisterCredentials>;
  refresh: UseMutateAsyncFunction<User, any, void, any>;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  isRegistering: boolean;
  isRefreshing: boolean;
  refetchUser: (
    options?: RefetchOptions | undefined
  ) => Promise<QueryObserverResult<User, Error>>;
  error: Error | null;
  tokenExpired: (token: any) => boolean;
  refreshExpired: (token: any) => boolean;
  refreshExpiredError: any;
  shouldRefreshOnBackground?: (token: Token) => boolean;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}

export function initReactQueryAuth<
  User = unknown,
  Error = unknown,
  LoginCredentials = unknown,
  RegisterCredentials = unknown
>(config: AuthProviderConfig<User, Error>) {
  const AuthContext = React.createContext<AuthContextValue<
    User,
    Error,
    LoginCredentials,
    RegisterCredentials
  > | null>(null);
  AuthContext.displayName = 'AuthContext';

  const {
    tokenExpired,
    refreshExpired,
    loadUserFn,
    loginFn,
    registerFn,
    refreshFn,
    logoutFn,
    refreshExpiredError,
    shouldRefreshOnBackground,
    key = 'auth-user',
    waitInitial = true,
    LoaderComponent = () => <div>Loading...</div>,
    ErrorComponent = (error: any) => (
      <div style={{ color: 'tomato' }}>{JSON.stringify(error, null, 2)}</div>
    ),
  } = config;

  function AuthProvider({ children }: AuthProviderProps): JSX.Element {
    const queryClient = useQueryClient();

    let tokenRefreshIntervalHandler: any;
    let tokenRefreshInterval: number = 5000;

    const getTokenFromStorage = () => {
      const storedValue = localStorage.getItem(queryKey);

      if (!storedValue) {
        return undefined;
      }

      let token: Token | undefined;

      try {
        token = JSON.parse(storedValue);
        // eslint-disable-next-line no-empty
      } catch {}

      return token;
    };

    const getToken = async (force = false) => {
      const token = getTokenFromStorage() as Token | undefined;

      if (token === undefined) return undefined;

      if (refreshExpired(token)) {
        throw refreshExpiredError;
      }

      if (tokenExpired(token) || force) {
        const newToken = await true;

        return newToken;
      }

      if (shouldRefreshOnBackground && shouldRefreshOnBackground(token)) {
        refresh();
      }

      return token;
    };

    const setTokenValue = (token: Token | undefined) => {
      if (token === undefined) {
        localStorage.removeItem(queryKey);
      } else {
        localStorage.setItem(queryKey, JSON.stringify(token));
      }

      // queryClient.setQueryData(queryKey, token);
    };

    const {
      data: user,
      error,
      status,
      isLoading,
      isIdle,
      isSuccess,
      refetch: refetchUser,
    } = useQuery<User, Error>({
      queryKey: key,
      queryFn: async () => {
        const token = (await getToken()) as Token;
        return loadUserFn(token);
      },
      onSuccess: (data: User) => {
        getToken();
      },
    });
    const queryKey = 'token';

    const loginMutation = useMutation({
      mutationFn: loginFn,
      onSuccess: token => {
        if (token !== undefined) {
          setTokenValue(token);
        }

        if (tokenRefreshInterval) {
          console.log(
            'logged in... start refresh interval',
            tokenRefreshInterval
          );
          startBackgroundRefreshing();
        }
        refetchUser();
      },
    });

    const refreshMutation = useMutation({
      mutationFn: refreshFn,
      onSuccess: token => {
        console.log('success refresh ran', token);
        if (token !== undefined) {
          console.log('set new token from refresh');
          setTokenValue(token);
        }
      },
    });

    const startBackgroundRefreshing = () => {
      clearInterval(tokenRefreshIntervalHandler);

      tokenRefreshIntervalHandler = setInterval(() => {
        refresh();
      }, tokenRefreshInterval);
    };

    const refresh = async () => {
      const token = (await getToken()) as Token;
      if (token) {
        console.log('start interval', 'run mutation', shouldRefreshOnBackground(token));
        const { refreshToken } = token;
        if (refreshToken) {
          refreshMutation.mutateAsync({ refreshToken: refreshToken });
        }
      }
    };

    const stopBackgroundRefreshing = () => {
      clearInterval(tokenRefreshIntervalHandler);
    };

    const registerMutation = useMutation({
      mutationFn: registerFn,
      onSuccess: user => {
        // setUser(user);
      },
    });

    const logoutMutation = useMutation({
      mutationFn: logoutFn,
      onSuccess: () => {
        queryClient.clear();
        stopBackgroundRefreshing();
      },
    });

    const value = React.useMemo(
      () => ({
        user,
        error,
        refreshExpiredError,
        shouldRefreshOnBackground,
        refetchUser: refetchUser,
        tokenExpired: tokenExpired,
        refreshExpired: refreshExpired,
        login: loginMutation.mutateAsync,
        isLoggingIn: loginMutation.isLoading,
        logout: logoutMutation.mutateAsync,
        isLoggingOut: logoutMutation.isLoading,
        register: registerMutation.mutateAsync,
        isRegistering: registerMutation.isLoading,
        refresh: refreshMutation.mutateAsync,
        isRefreshing: refreshMutation.isLoading,
      }),
      [
        user,
        error,
        refetchUser,
        tokenExpired,
        refreshExpired,
        loginMutation.mutateAsync,
        loginMutation.isLoading,
        logoutMutation.mutateAsync,
        logoutMutation.isLoading,
        registerMutation.mutateAsync,
        registerMutation.isLoading,
        refreshMutation.mutateAsync,
        refreshMutation.isLoading,
      ]
    );

    // if (isSuccess || !waitInitial) {
    return (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
    // }

    // if (isLoading || isIdle) {
    //   return <LoaderComponent />;
    // }

    // if (error) {
    //   return <ErrorComponent error={error} />;
    // }

    // return <div>Unhandled status: {status}</div>;
  }

  function useAuth() {
    const context = React.useContext(AuthContext);
    if (!context) {
      throw new Error(`useAuth must be used within an AuthProvider`);
    }
    return context;
  }

  return { AuthProvider, AuthConsumer: AuthContext.Consumer, useAuth };
}
