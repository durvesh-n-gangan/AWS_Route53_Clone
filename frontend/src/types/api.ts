/** Shapes shared with the FastAPI backend (PROJECT_PLAN.md section 4). */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

export interface CurrentUser {
  username: string;
  account_id: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
