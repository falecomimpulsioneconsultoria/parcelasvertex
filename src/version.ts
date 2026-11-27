export interface AppVersionInfo {
  version: string;
  releaseDate: string;
  buildNumber: string;
  notes: string[];
}

export const APP_VERSION: AppVersionInfo = {
  version: '1.2.0',
  releaseDate: '26/11/2026',
  buildNumber: '20261126.1',
  notes: [
    'Conciliação inteligente de relatórios PDF com suporte a empresas filhas (Shazam) e cálculo automático de diferencial da empresa mãe.',
    'Novo sistema de versionador visual com histórico de atualizações e badges de status.'
  ]
};
