// Each public experience owns its practice state and report. Never derive these
// boundaries from a visitor-controlled query string or a live organisation.
export const experiencePartners = {
  leap9: {
    organisation: 'Leap9', path: '/experience/leap9/v2',
    storageKey: 'bis.programme-experience.leap9.v2', reportPath: '/experience/leap9/report',
  },
  dgmt: {
    organisation: 'DGMT', path: '/experience/dgmt',
    storageKey: 'bis.programme-experience.dgmt.v1', reportPath: '/experience/dgmt/report',
  },
  vodacom: {
    organisation: 'Vodacom Foundation', path: '/experience/vodacom/v2',
    storageKey: 'bis.programme-experience.vodacom.v2', reportPath: '/experience/vodacom/report',
  },
  sasol: {
    organisation: 'Sasol Foundation', path: '/experience/sasol/v2',
    storageKey: 'bis.programme-experience.sasol.v2', reportPath: '/experience/sasol/report',
  },
  primestars: {
    organisation: 'Primestars', path: '/experience/primestars/v2',
    storageKey: 'bis.programme-experience.primestars.v2', reportPath: '/experience/primestars/report',
  },
  jasa: {
    organisation: 'JA South Africa', path: '/experience/jasa/v2',
    storageKey: 'bis.programme-experience.jasa.v2', reportPath: '/experience/jasa/report',
  },
  momentum: {
    organisation: 'Momentum Group Foundation', path: '/experience/momentum/v2',
    storageKey: 'bis.programme-experience.momentum.v2', reportPath: '/experience/momentum/report',
  },
  tutuwa: {
    organisation: 'Standard Bank Tutuwa Community Foundation', path: '/experience/tutuwa/v2',
    storageKey: 'bis.programme-experience.tutuwa.v2', reportPath: '/experience/tutuwa/report',
  },
} as const;
export type ExperiencePartner = keyof typeof experiencePartners;
