import type { LabApi } from '../../app/lab/Lab'

declare global {
  interface Window {
    rareshapeLab?: LabApi
  }
}

export {}
