export type CarSettings = {
  gasolineAutonomy: string;
  alcoholAutonomy: string;
};

export const EMPTY_CAR_SETTINGS: CarSettings = {
  alcoholAutonomy: '5,6 Km/l',
  gasolineAutonomy: '7,4 Km/l',
};
