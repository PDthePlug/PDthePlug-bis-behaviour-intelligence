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
} as const;
export type ExperiencePartner = keyof typeof experiencePartners;
