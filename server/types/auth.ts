export type AuthUser = {
  uid: string;
  name: string;
  team: string;
};

export type LoginBody = {
  name?: string;
  password?: string;
};

export type RegisterBody = {
  name?: string;
  password?: string;
  team?: string;
};
