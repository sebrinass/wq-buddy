export interface Credentials {
  username: string;
  password: string;
}

export interface SimulationSettings {
  instrumentType: string;
  region: string;
  universe: string;
  delay: number;
  decay: number;
  neutralization: string;
  truncation: number;
  pasteurization: string;
  unitHandling: string;
  nanHandling: string;
  language: string;
  visualization: boolean;
}

export interface SimulationData {
  type: string;
  settings: SimulationSettings;
  regular: string;
}

export interface AlphaRecord {
  id: number;
  alpha_id: string | null;
  expression: string;
  field: string;
  status: 'pending' | 'success' | 'failed' | 'error' | 'running';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataField {
  field_id: string;
  name: string;
  description: string;
  dataset_id: string;
  data_type: string;
  region: string;
  fetched_at: string;
}

export interface BatchRecord {
  id: number;
  batch_name: string;
  description: string;
  total_count: number;
  success_count: number;
  fail_count: number;
  created_at: string;
  status: string;
}

export interface AppConfig {
  version: string;
  credentials: Credentials;
  default_settings: SimulationSettings;
  database: {
    type: string;
    path: string;
  };
  batch_settings: {
    sleep_between_requests: number;
    max_retries: number;
    timeout_seconds: number;
  };
}
