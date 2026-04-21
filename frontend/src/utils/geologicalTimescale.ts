export interface GeologicPeriod {
  name: string
  abbreviation: string
  start_ma: number
  end_ma: number
  color: string
}

export const GEOLOGIC_PERIODS: GeologicPeriod[] = [
  { name: 'Quaternary',    abbreviation: 'Q',  start_ma: 2.58,  end_ma: 0,     color: '#f9f97f' },
  { name: 'Neogene',       abbreviation: 'N',  start_ma: 23.03, end_ma: 2.58,  color: '#ffff00' },
  { name: 'Paleogene',     abbreviation: 'Pg', start_ma: 66.0,  end_ma: 23.03, color: '#fd9a52' },
  { name: 'Cretaceous',    abbreviation: 'K',  start_ma: 145.0, end_ma: 66.0,  color: '#7fc64e' },
  { name: 'Jurassic',      abbreviation: 'J',  start_ma: 201.4, end_ma: 145.0, color: '#34b2c9' },
  { name: 'Triassic',      abbreviation: 'Tr', start_ma: 251.9, end_ma: 201.4, color: '#812b92' },
  { name: 'Permian',       abbreviation: 'P',  start_ma: 298.9, end_ma: 251.9, color: '#f04028' },
  { name: 'Carboniferous', abbreviation: 'C',  start_ma: 358.9, end_ma: 298.9, color: '#67a599' },
  { name: 'Devonian',      abbreviation: 'D',  start_ma: 419.2, end_ma: 358.9, color: '#cb8c37' },
  { name: 'Silurian',      abbreviation: 'S',  start_ma: 443.8, end_ma: 419.2, color: '#b3e1b6' },
  { name: 'Ordovician',    abbreviation: 'O',  start_ma: 485.4, end_ma: 443.8, color: '#009270' },
  { name: 'Cambrian',      abbreviation: 'Cm', start_ma: 538.8, end_ma: 485.4, color: '#7fa056' },
  { name: 'Precambrian',   abbreviation: 'pC', start_ma: 4000,  end_ma: 538.8, color: '#f74370' },
]
