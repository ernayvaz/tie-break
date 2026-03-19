const SCOREAXIS_BASE_URL = "https://widgets.scoreaxis.com/api/football";
export const SCOREAXIS_UCL_LEAGUE_ID = "6232267fbf1fa71a67215dfc";

function parseScoreAxisOverrideMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
}

const BASE_SCOREAXIS_TEAM_IDS: Record<string, string> = {
  "afc ajax": "62321affadaf4b2bd73de3fc",
  "arsenal fc": "62321b19adaf4b2bd73de890",
  "as monaco fc": "62321b04adaf4b2bd73de4e8",
  "atalanta bc": "62321b1aadaf4b2bd73de8c4",
  "athletic club": "62321b32adaf4b2bd73dece4",
  "bayer 04 leverkusen": "62321affadaf4b2bd73de3f4",
  "borussia dortmund": "62321b03adaf4b2bd73de4c8",
  "chelsea fc": "62321b27adaf4b2bd73deaea",
  "club atletico de madrid": "62321b10adaf4b2bd73de722",
  "club brugge kv": "62321b0badaf4b2bd73de620",
  "eintracht frankfurt": "62321b30adaf4b2bd73dec68",
  "fc barcelona": "62321b15adaf4b2bd73de814",
  "fc bayern munchen": "62321afbadaf4b2bd73de344",
  "fc internazionale milano": "62321b07adaf4b2bd73de56e",
  "fc k benhavn": "62321b27adaf4b2bd73deadc",
  "fk bod glimt": "62322a24facff455923dfeb2",
  "fk kairat": "623225ce09ac1611ee0dc2cc",
  "galatasaray sk": "62321b29adaf4b2bd73deb58",
  "juventus fc": "62321affadaf4b2bd73de3f8",
  "liverpool fc": "62321afeadaf4b2bd73de3ec",
  "manchester city fc": "62321b13adaf4b2bd73de7a6",
  "newcastle united fc": "62321b39adaf4b2bd73dee16",
  "olympique de marseille": "62321b1aadaf4b2bd73de8a4",
  "pae olympiakos sfp": "62322a24facff455923dfeae",
  "paphos fc": "6232272c1d8bb27a0a6381aa",
  "paris saint germain fc": "62321b04adaf4b2bd73de4ec",
  "psv": "62321b29adaf4b2bd73deb36",
  "qarabag agdam fk": "62321a4be21aa227272bbe30",
  "real madrid cf": "62321afdadaf4b2bd73de3be",
  "royale union saint gilloise": "62321afcadaf4b2bd73de390",
  "sk slavia praha": "62321b11adaf4b2bd73de762",
  "sport lisboa e benfica": "62321a00bfa83e58f743179a",
  "sporting clube de portugal": "62321a07bfa83e58f74318e6",
  "ssc napoli": "62321b1aadaf4b2bd73de8c0",
  "tottenham hotspur fc": "62321b0fadaf4b2bd73de6f8",
  "villarreal cf": "62321b2aadaf4b2bd73deb7c"
};

const SCOREAXIS_ALIASES: Record<string, string> = {
  "ajax": "afc ajax",
  "arsenal": "arsenal fc",
  "atalanta": "atalanta bc",
  "athletic bilbao": "athletic club",
  "atletico madrid": "club atletico de madrid",
  "barcelona": "fc barcelona",
  "bayer leverkusen": "bayer 04 leverkusen",
  "bayern munchen": "fc bayern munchen",
  "bayern munich": "fc bayern munchen",
  "benfica": "sport lisboa e benfica",
  "bodo glimt": "fk bod glimt",
  "bodoe glimt": "fk bod glimt",
  "borussia dortmund": "borussia dortmund",
  "club brugge": "club brugge kv",
  "copenhagen": "fc k benhavn",
  "dortmund": "borussia dortmund",
  "eintracht frankfurt": "eintracht frankfurt",
  "fc copenhagen": "fc k benhavn",
  "galatasaray": "galatasaray sk",
  "inter": "fc internazionale milano",
  "inter milan": "fc internazionale milano",
  "internazionale": "fc internazionale milano",
  "juventus": "juventus fc",
  "kairat": "fk kairat",
  "liverpool": "liverpool fc",
  "man city": "manchester city fc",
  "manchester city": "manchester city fc",
  "marseille": "olympique de marseille",
  "monaco": "as monaco fc",
  "napoli": "ssc napoli",
  "newcastle": "newcastle united fc",
  "newcastle united": "newcastle united fc",
  "olympiacos": "pae olympiakos sfp",
  "olympiakos": "pae olympiakos sfp",
  "pafos": "paphos fc",
  "paphos": "paphos fc",
  "paris saint germain": "paris saint germain fc",
  "psg": "paris saint germain fc",
  "psv eindhoven": "psv",
  "qarabag": "qarabag agdam fk",
  "real madrid": "real madrid cf",
  "saint gilloise": "royale union saint gilloise",
  "slavia prague": "sk slavia praha",
  "slavia praha": "sk slavia praha",
  "sporting": "sporting clube de portugal",
  "sporting cp": "sporting clube de portugal",
  "tottenham": "tottenham hotspur fc",
  "tottenham hotspur": "tottenham hotspur fc",
  "union saint gilloise": "royale union saint gilloise",
  "union sg": "royale union saint gilloise",
  "union st gilloise": "royale union saint gilloise",
  "villarreal": "villarreal cf"
};

const SCOREAXIS_TEAM_IDS: Record<string, string> = {
  ...BASE_SCOREAXIS_TEAM_IDS,
  ...parseScoreAxisOverrideMap(process.env.NEXT_PUBLIC_SCOREAXIS_TEAM_IDS_JSON),
};

const BASE_SCOREAXIS_MATCH_IDS_BY_EXTERNAL_API_ID: Record<string, string> = {
  "551908": "68b149fc23fc4d0b480ce4d4",
  "551909": "68b149fce9f59706ce025704",
  "551910": "68b149fcc73b43c9230404c2",
  "551911": "68b149fc36e084bc6c035004",
  "551912": "68b149fc4b0365a12d08a3f2",
  "551913": "68b149fcf08c1836a40a18b4",
  "551914": "68b149fc7ceb5e367c0d9e86",
  "551915": "68b149fc2d72f35fe7019122",
  "551916": "68b149fcd3aad8b5fa052f82",
  "551917": "68b149fc23fc4d0b480ce4d6",
  "551918": "68b149fce9f59706ce025706",
  "551919": "68b149fc7ceb5e367c0d9e88",
  "551920": "68b149fc36e084bc6c035006",
  "551921": "68b149fcc73b43c9230404c4",
  "551922": "68b149fcf08c1836a40a18b6",
  "551923": "68b149fc2d72f35fe7019124",
  "551924": "68b149fc4b0365a12d08a3f4",
  "551925": "68b149fc23fc4d0b480ce4d8",
  "551926": "68b149fce9f59706ce025708",
  "551927": "68b149fc4b0365a12d08a3f6",
  "551928": "68b149fcd3aad8b5fa052f84",
  "551929": "68b149fcd3aad8b5fa052f86",
  "551930": "68b149fcd3aad8b5fa052f88",
  "551931": "68b149fcd3aad8b5fa052f8a",
  "551932": "68b149fcd3aad8b5fa052f8c",
  "551933": "68b149fdd3aad8b5fa052f92",
  "551934": "68b149fdd3aad8b5fa052f96",
  "551935": "68b149fdd3aad8b5fa052f98",
  "551936": "68b149fd36e084bc6c035008",
  "551937": "68b149fd7ceb5e367c0d9e8a",
  "551938": "68b149fdc73b43c9230404c6",
  "551939": "68b149fd2d72f35fe7019126",
  "551940": "68b149fd23fc4d0b480ce4da",
  "551941": "68b149fd36e084bc6c03500a",
  "551942": "68b149fde9f59706ce02570a",
  "551943": "68b149fdf08c1836a40a18b8",
  "551944": "68b149fdd3aad8b5fa052f9a",
  "551945": "68b149fd7ceb5e367c0d9e8c",
  "551946": "68b149fd2d72f35fe7019128",
  "551947": "68b149fdc73b43c9230404c8",
  "551948": "68b149fd4b0365a12d08a3f8",
  "551949": "68b149fd23fc4d0b480ce4dc",
  "551950": "68b149fde9f59706ce02570c",
  "551951": "68b149fdd3aad8b5fa052f9c",
  "551952": "68b149fdd3aad8b5fa052f9e",
  "551953": "68b149fdd3aad8b5fa052fa0",
  "551954": "68b149fdd3aad8b5fa052fa2",
  "551955": "68b149fdd3aad8b5fa052fa4",
  "551956": "68b149fed3aad8b5fa052fa6",
  "551957": "68b149fed3aad8b5fa052fa8",
  "551958": "68b149fed3aad8b5fa052faa",
  "551959": "68b149fed3aad8b5fa052fb0",
  "551960": "68b149fed3aad8b5fa052fae",
  "551961": "68b149fed3aad8b5fa052fac",
  "551962": "68b149fe36e084bc6c03500c",
  "551963": "68b149fed3aad8b5fa052fb4",
  "551964": "68b149fe2d72f35fe701912a",
  "551965": "68b149ff2d4cec13eb037c22",
  "551966": "68b149ffc73b43c9230404ca",
  "551967": "68b149ff4b0365a12d08a3fa",
  "551968": "68b149ff23fc4d0b480ce4de",
  "551969": "68b149fe7ceb5e367c0d9e8e",
  "551970": "68b149ff36e084bc6c03500e",
  "551971": "68b149ffe9f59706ce02570e",
  "551972": "68b149ffd3aad8b5fa052fb6",
  "551973": "68b149ffc73b43c9230404cc",
  "551974": "68b149ff7ceb5e367c0d9e90",
  "551975": "68b149ff2d72f35fe701912c",
  "551976": "68b149ff4b0365a12d08a3fc",
  "551977": "68b149ff23fc4d0b480ce4e0",
  "551978": "68b149ffe9f59706ce025710",
  "551979": "68b149ff2d4cec13eb037c24",
  "551980": "68b149ff36e084bc6c035010",
  "551981": "68b149ffd3aad8b5fa052fb8",
  "551982": "68b149ff9277d139a40c7412",
  "551983": "68b149ff2d72f35fe701912e",
  "551984": "68b149ff7ceb5e367c0d9e92",
  "551985": "68b149ffc73b43c9230404ce",
  "551986": "68b149ff4b0365a12d08a3fe",
  "551987": "68b149ff23fc4d0b480ce4e2",
  "551988": "68b149ffe9f59706ce025712",
  "551989": "68b149ff36e084bc6c035012",
  "551990": "68b149ff2d4cec13eb037c26",
  "551991": "68b149ffd3aad8b5fa052fba",
  "551992": "68b149ff2d72f35fe7019130",
  "551993": "68b149ffd3aad8b5fa052fbc",
  "551994": "68b14a009277d139a40c7414",
  "551995": "68b14a009277d139a40c7416",
  "551996": "68b14a009277d139a40c7418",
  "551997": "68b14a009277d139a40c741a",
  "551998": "68b14a009277d139a40c741c",
  "551999": "68b14a009277d139a40c741e",
  "552000": "68b14a009277d139a40c7420",
  "552001": "68b14a009277d139a40c7422",
  "552002": "68b14a009277d139a40c7424",
  "552003": "68b14a0023fc4d0b480ce4e4",
  "552004": "68b14a007ceb5e367c0d9e94",
  "552005": "68b14a009277d139a40c7426",
  "552006": "68b14a00c73b43c9230404d0",
  "552007": "68b14a004b0365a12d08a400",
  "552008": "68b14a009277d139a40c7428",
  "552009": "68b14a00e9f59706ce025714",
  "552010": "68b14a0036e084bc6c035014",
  "552011": "68b14a002d4cec13eb037c28",
  "552012": "68b14a012d72f35fe7019132",
  "552013": "68b14a017ceb5e367c0d9e96",
  "552014": "68b14a0123fc4d0b480ce4e6",
  "552015": "68b14a019277d139a40c742a",
  "552016": "68b14a01c73b43c9230404d2",
  "552017": "68b14a01e9f59706ce025716",
  "552018": "68b14a014b0365a12d08a402",
  "552019": "68b14a012d72f35fe7019134",
  "552020": "68b14a012d72f35fe7019136",
  "552021": "68b14a012d72f35fe7019138",
  "552022": "68b14a012d72f35fe701913a",
  "552023": "68b14a012d72f35fe701913c",
  "552024": "68b14a012d72f35fe701913e",
  "552025": "68b14a012d72f35fe7019140",
  "552026": "68b14a022d72f35fe7019142",
  "552027": "68b14a022d72f35fe701914a",
  "552028": "68b14a022d72f35fe7019144",
  "552029": "68b14a03d3aad8b5fa052fbe",
  "552030": "68b14a032d4cec13eb037c2a",
  "552031": "68b14a022d72f35fe7019148",
  "552032": "68b14a022d72f35fe7019146",
  "552033": "68b14a032d72f35fe701914c",
  "552034": "68b14a0323fc4d0b480ce4e8",
  "552035": "68b14a03e9f59706ce025718",
  "552036": "68b14a034b0365a12d08a404",
  "552037": "68b14a03d3aad8b5fa052fc0",
  "552038": "68b14a0323fc4d0b480ce4ea",
  "552039": "68b14a037ceb5e367c0d9e9a",
  "552040": "68b14a032d72f35fe701914e",
  "552041": "68b14a03c73b43c9230404d6",
  "552042": "68b14a03e9f59706ce02571a",
  "552043": "68b14a034b0365a12d08a406",
  "552044": "68b14a032d4cec13eb037c2e",
  "552045": "68b14a039277d139a40c742e",
  "552046": "68b14a03d3aad8b5fa052fc2",
  "552047": "68b14a032d4cec13eb037c2c",
  "552048": "68b14a039277d139a40c742c",
  "552049": "68b14a03c73b43c9230404d4",
  "552050": "68b149fed3aad8b5fa052fb2",
  "552051": "68b14a037ceb5e367c0d9e98",
  "552052": "697ca26a7a16643acf015a52",
  "552053": "697ca26a567533b8cd0fd564",
  "552054": "697ca26a41ae9f9c220a5a4e",
  "552055": "697ca26ac5ea5b6ba70ed874",
  "552056": "697ca26a725ba0765a0decd2",
  "552057": "697ca26a3c72b9e44b09559a",
  "552058": "697ca26a567533b8cd0fd566",
  "552059": "697ca26aeacdaab77509cd22",
  "552060": "697ca26aeacdaab77509cd24",
  "552061": "697ca26bc5ea5b6ba70ed876",
  "552062": "697ca26b567533b8cd0fd568",
  "552063": "697ca26beacdaab77509cd26",
  "552064": "697ca26b725ba0765a0decd4",
  "552065": "697ca26b479ebad66d0ba8ba",
  "552066": "697ca26beacdaab77509cd28",
  "552067": "697ca26b41ae9f9c220a5a50",
  "552068": "69a18c03851047f48303cc36",
  "552069": "69a18c03ae6b02382e0dc914",
  "552070": "69a18c0363657f806f0fbb52",
  "552071": "69a18c03f8a719b7a9017022",
  "552072": "69a18c0317654b83cc049652",
  "552073": "69a18c03e761820516087982",
  "552074": "69a18c035d5b9f98590d7792",
  "552075": "69a18c03851047f48303cc38",
  "552076": "69a18c0363657f806f0fbb54",
  "552077": "69a18c03ae6b02382e0dc91a",
  "552078": "69a18c0317654b83cc049654",
  "552079": "69a18c03ae6b02382e0dc91c",
  "552080": "69a18c03ae6b02382e0dc918",
  "552081": "69a18c03dd36764dea0cf5b2",
  "552082": "69a18c03f1579dc8780f6632",
  "552083": "69a18c03ae6b02382e0dc91e",
  "556718": "69a18c03ae6b02382e0dc926",
  "556719": "69a18c03dd36764dea0cf5b4",
  "556720": "69a18c03ae6b02382e0dc92c",
  "556721": "69a18c04e761820516087998",
  "556722": "69a18c04e76182051608799a",
  "556723": "69a18c04dd36764dea0cf5ba",
  "556724": "69a18c04dd36764dea0cf5bc",
  "556725": "69a18c04e76182051608799c"
};

const SCOREAXIS_MATCH_IDS_BY_EXTERNAL_API_ID: Record<string, string> = {
  ...BASE_SCOREAXIS_MATCH_IDS_BY_EXTERNAL_API_ID,
  ...parseScoreAxisOverrideMap(
    process.env.NEXT_PUBLIC_SCOREAXIS_MATCH_IDS_JSON
  ),
};

const BASE_SCOREAXIS_LEAGUE_IDS: Record<string, string> = {
  "1 division cyprus": "623238316c429452755aeb20",
  "bundesliga germany": "62321f50f7016c22d3650732",
  "eliteserien norway": "623237a54300532eb00152a4",
  "english premier league": "6232265abf1fa71a672159ec",
  "eredivisie netherlands": "62322b9003f74f47356935a4",
  "first league czech republic": "62322cc1c3b9e7302a05bd86",
  "laliga spain": "62322c053617da0b83221cc6",
  "ligue 1 france": "62322b4efd209951602c9096",
  "premier league azerbaijan": "6232314647bdf7425577b478",
  "premier league kazakhstan": "623225d18bde14694d4e4888",
  "primeira liga portugal": "623237abb593273124091ff8",
  "pro league belgium": "62322afb042d363ec41adad6",
  "serie a italy": "62322b827aee66235a2be718",
  "super league greece": "623238b095d772725b6964b6",
  "super lig turkey": "62322bd0c7f2c13284422b22",
  "superliga denmark": "62322b0a430673239d411e14",
  "uefa champions league": "6232267fbf1fa71a67215dfc"
};

const SCOREAXIS_LEAGUE_DISPLAY_NAMES: Record<string, string> = {
  "1 division cyprus": "1. Division Cyprus",
  "bundesliga germany": "Bundesliga Germany",
  "eliteserien norway": "Eliteserien Norway",
  "english premier league": "English Premier League",
  "eredivisie netherlands": "Eredivisie Netherlands",
  "first league czech republic": "First League Czech Republic",
  "laliga spain": "LaLiga Spain",
  "ligue 1 france": "Ligue 1 France",
  "premier league azerbaijan": "Premier League Azerbaijan",
  "premier league kazakhstan": "Premier League Kazakhstan",
  "primeira liga portugal": "Primeira Liga Portugal",
  "pro league belgium": "Pro League Belgium",
  "serie a italy": "Serie A Italy",
  "super league greece": "Super League Greece",
  "super lig turkey": "Super Lig Turkey",
  "superliga denmark": "Superliga Denmark",
  "uefa champions league": "Champions League"
};

const SCOREAXIS_LEAGUE_IDS: Record<string, string> = {
  ...BASE_SCOREAXIS_LEAGUE_IDS,
  ...parseScoreAxisOverrideMap(process.env.NEXT_PUBLIC_SCOREAXIS_LEAGUE_IDS_JSON),
};

const EXACT_SCOREAXIS_LEAGUE_TABLE_WIDGETS: Record<
  string,
  {
    leagueKey: string;
    leagueName: string;
    widgetId: string;
    src: string;
  }
> = {
  "english premier league": {
    leagueKey: "english premier league",
    leagueName: "English Premier League",
    widgetId: "kaa6mmx957hu",
    src: "https://widgets.scoreaxis.com/api/football/league-table/6232265abf1fa71a672159ec?widgetId=kaa6mmx957hu&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=12&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd",
  },
  "laliga spain": {
    leagueKey: "laliga spain",
    leagueName: "LaLiga Spain",
    widgetId: "xcybmmx9c0yo",
    src: "https://widgets.scoreaxis.com/api/football/league-table/62322c053617da0b83221cc6?widgetId=xcybmmx9c0yo&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=12&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd",
  },
  "bundesliga germany": {
    leagueKey: "bundesliga germany",
    leagueName: "Bundesliga Germany",
    widgetId: "ey5tmmx9cf1s",
    src: "https://widgets.scoreaxis.com/api/football/league-table/62321f50f7016c22d3650732?widgetId=ey5tmmx9cf1s&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=12&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd",
  },
  "ligue 1 france": {
    leagueKey: "ligue 1 france",
    leagueName: "Ligue 1 France",
    widgetId: "vxslmmx9d5wo",
    src: "https://widgets.scoreaxis.com/api/football/league-table/62322b4efd209951602c9096?widgetId=vxslmmx9d5wo&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=12&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd",
  },
  "serie a italy": {
    leagueKey: "serie a italy",
    leagueName: "Serie A Italy",
    widgetId: "02kammx9dhoo",
    src: "https://widgets.scoreaxis.com/api/football/league-table/62322b827aee66235a2be718?widgetId=02kammx9dhoo&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=12&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd",
  },
  "primeira liga portugal": {
    leagueKey: "primeira liga portugal",
    leagueName: "Primeira Liga Portugal",
    widgetId: "zkdemmx9egbj",
    src: "https://widgets.scoreaxis.com/api/football/league-table/623237abb593273124091ff8?widgetId=zkdemmx9egbj&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=12&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd",
  },
  "super lig turkey": {
    leagueKey: "super lig turkey",
    leagueName: "Super Lig Turkey",
    widgetId: "49wqmmx9f30o",
    src: "https://widgets.scoreaxis.com/api/football/league-table/62322bd0c7f2c13284422b22?widgetId=49wqmmx9f30o&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=12&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd",
  },
};

const SCOREAXIS_LEAGUE_ALIASES: Record<string, string> = {
  "1 division cyprus": "1 division cyprus",
  "azerbaijan premier league": "premier league azerbaijan",
  "belgian pro league": "pro league belgium",
  "bundesliga": "bundesliga germany",
  "bundesliga germany": "bundesliga germany",
  "champions": "uefa champions league",
  "champions league": "uefa champions league",
  "cypriot first division": "1 division cyprus",
  "cyprus first division": "1 division cyprus",
  "czech first league": "first league czech republic",
  "czech liga": "first league czech republic",
  "danish superliga": "superliga denmark",
  "eliteserien": "eliteserien norway",
  "eliteserien norway": "eliteserien norway",
  "english premier league": "english premier league",
  "epl": "english premier league",
  "eredivisie": "eredivisie netherlands",
  "eredivisie netherlands": "eredivisie netherlands",
  "first league czech republic": "first league czech republic",
  "greece super league": "super league greece",
  "kazakhstan premier league": "premier league kazakhstan",
  "la liga": "laliga spain",
  "laliga": "laliga spain",
  "laliga spain": "laliga spain",
  "ligue 1": "ligue 1 france",
  "ligue 1 france": "ligue 1 france",
  "premier league": "english premier league",
  "premier league azerbaijan": "premier league azerbaijan",
  "premier league kazakhstan": "premier league kazakhstan",
  "primeira liga": "primeira liga portugal",
  "primeira liga portugal": "primeira liga portugal",
  "pro league belgium": "pro league belgium",
  "serie a": "serie a italy",
  "serie a italy": "serie a italy",
  "super league greece": "super league greece",
  "super lig": "super lig turkey",
  "super lig turkey": "super lig turkey",
  "superliga denmark": "superliga denmark",
  "uefa champions league": "uefa champions league"
};

const SCOREAXIS_LEAGUE_KEYS_BY_COMPETITION_CODE: Record<string, string> = {
  "BL1": "bundesliga germany",
  "CL": "uefa champions league",
  "DED": "eredivisie netherlands",
  "FL1": "ligue 1 france",
  "PD": "laliga spain",
  "PL": "english premier league",
  "PPL": "primeira liga portugal",
  "SA": "serie a italy"
};

const SCOREAXIS_DOMESTIC_LEAGUE_KEYS_BY_TEAM: Record<string, string> = {
  "afc ajax": "eredivisie netherlands",
  "arsenal fc": "english premier league",
  "as monaco fc": "ligue 1 france",
  "atalanta bc": "serie a italy",
  "athletic club": "laliga spain",
  "bayer 04 leverkusen": "bundesliga germany",
  "borussia dortmund": "bundesliga germany",
  "chelsea fc": "english premier league",
  "club atletico de madrid": "laliga spain",
  "club brugge kv": "pro league belgium",
  "eintracht frankfurt": "bundesliga germany",
  "fc barcelona": "laliga spain",
  "fc bayern munchen": "bundesliga germany",
  "fc internazionale milano": "serie a italy",
  "fc k benhavn": "superliga denmark",
  "fk bod glimt": "eliteserien norway",
  "fk kairat": "premier league kazakhstan",
  "galatasaray sk": "super lig turkey",
  "juventus fc": "serie a italy",
  "liverpool fc": "english premier league",
  "manchester city fc": "english premier league",
  "newcastle united fc": "english premier league",
  "olympique de marseille": "ligue 1 france",
  "pae olympiakos sfp": "super league greece",
  "paphos fc": "1 division cyprus",
  "paris saint germain fc": "ligue 1 france",
  "psv": "eredivisie netherlands",
  "qarabag agdam fk": "premier league azerbaijan",
  "real madrid cf": "laliga spain",
  "royale union saint gilloise": "pro league belgium",
  "sk slavia praha": "first league czech republic",
  "sport lisboa e benfica": "primeira liga portugal",
  "sporting clube de portugal": "primeira liga portugal",
  "ssc napoli": "serie a italy",
  "tottenham hotspur fc": "english premier league",
  "villarreal cf": "laliga spain"
};

type ScoreAxisWidgetKind =
  | "league-table"
  | "live-match"
  | "team-top-players"
  | "team-info"
  | "league-top-players";

const SCOREAXIS_WIDGET_BASE_PARAMS: Record<string, string> = {
  lang: "en",
  font: "heebo",
  fontSize: "14",
  rowDensity: "100",
  widgetWidth: "auto",
  widgetHeight: "auto",
  bodyColor: "#ffffff",
  textColor: "#141416",
  linkColor: "#141416",
  borderColor: "#ecf1f7",
  tabColor: "#f3f8fd",
};

const SCOREAXIS_WIDGET_PARAMS_BY_KIND: Record<
  ScoreAxisWidgetKind,
  Record<string, string>
> = {
  "league-table": {
    teamLogo: "1",
    tableLines: "0",
    homeAway: "1",
    header: "1",
    position: "1",
    goals: "1",
    gamesCount: "1",
    diff: "1",
    winCount: "1",
    drawCount: "1",
    loseCount: "1",
    lastGames: "1",
    points: "1",
    teamsLimit: "all",
    links: "1",
    fontSize: "12",
  },
  "league-top-players": {
    playersCount: "10",
    goalsBlock: "1",
    assistsBlock: "1",
    cardsBlock: "1",
  },
  "live-match": {
    lineupsBlock: "1",
    eventsBlock: "1",
    statsBlock: "1",
    links: "1",
  },
  "team-info": {
    statsBlock: "1",
    playersBlock: "1",
    matchesBlock: "1",
    links: "1",
  },
  "team-top-players": {
    playersCount: "10",
    goalsBlock: "1",
    assistsBlock: "1",
    cardsBlock: "1",
    links: "1",
  },
};

export type ScoreAxisLeagueInfo = {
  leagueId: string;
  leagueKey: string;
  leagueName: string;
};

export type ScoreAxisExactLeagueWidget = {
  leagueKey: string;
  leagueName: string;
  widgetId: string;
  src: string;
};

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveScoreAxisTeamKey(teamName: string): string | null {
  const normalized = normalizeKey(teamName);
  const canonicalKey = SCOREAXIS_ALIASES[normalized] ?? normalized;
  return SCOREAXIS_TEAM_IDS[canonicalKey] ? canonicalKey : null;
}

function buildScoreAxisLeagueInfo(
  leagueKey: string | null | undefined
): ScoreAxisLeagueInfo | null {
  if (!leagueKey) return null;

  const leagueId = SCOREAXIS_LEAGUE_IDS[leagueKey];
  if (!leagueId) return null;

  return {
    leagueId,
    leagueKey,
    leagueName: SCOREAXIS_LEAGUE_DISPLAY_NAMES[leagueKey] ?? "Domestic league",
  };
}

function resolveScoreAxisLeagueKey(leagueName: string): string | null {
  const normalizedLeagueName = normalizeKey(leagueName);
  const canonicalLeagueKey =
    SCOREAXIS_LEAGUE_ALIASES[normalizedLeagueName] ?? normalizedLeagueName;

  return SCOREAXIS_LEAGUE_IDS[canonicalLeagueKey] ? canonicalLeagueKey : null;
}

export function getScoreAxisTeamId(teamName: string): string | null {
  const teamKey = resolveScoreAxisTeamKey(teamName);
  return teamKey ? SCOREAXIS_TEAM_IDS[teamKey] ?? null : null;
}

export function getScoreAxisUclLeagueId(): string {
  return SCOREAXIS_UCL_LEAGUE_ID;
}

export function getScoreAxisLeagueId(input: {
  competitionCode?: string | null;
  leagueName?: string | null;
}): string | null {
  const normalizedCompetitionCode = input.competitionCode?.trim().toUpperCase();
  if (normalizedCompetitionCode) {
    const canonicalLeagueKey =
      SCOREAXIS_LEAGUE_KEYS_BY_COMPETITION_CODE[normalizedCompetitionCode];
    if (canonicalLeagueKey) {
      return SCOREAXIS_LEAGUE_IDS[canonicalLeagueKey] ?? null;
    }
  }

  if (!input.leagueName) return null;

  const leagueKey = resolveScoreAxisLeagueKey(input.leagueName);
  return leagueKey ? SCOREAXIS_LEAGUE_IDS[leagueKey] ?? null : null;
}

export function getScoreAxisLeagueInfo(input: {
  competitionCode?: string | null;
  leagueName?: string | null;
}): ScoreAxisLeagueInfo | null {
  const normalizedCompetitionCode = input.competitionCode?.trim().toUpperCase();
  if (normalizedCompetitionCode) {
    const canonicalLeagueKey =
      SCOREAXIS_LEAGUE_KEYS_BY_COMPETITION_CODE[normalizedCompetitionCode];
    if (canonicalLeagueKey) {
      return buildScoreAxisLeagueInfo(canonicalLeagueKey);
    }
  }

  if (!input.leagueName) return null;
  return buildScoreAxisLeagueInfo(resolveScoreAxisLeagueKey(input.leagueName));
}

export function getScoreAxisDomesticLeagueInfo(
  teamName: string
): ScoreAxisLeagueInfo | null {
  const teamKey = resolveScoreAxisTeamKey(teamName);
  if (!teamKey) return null;

  const leagueKey = SCOREAXIS_DOMESTIC_LEAGUE_KEYS_BY_TEAM[teamKey];
  return buildScoreAxisLeagueInfo(leagueKey);
}

export function getExactScoreAxisLeagueTableWidget(input: {
  competitionCode?: string | null;
  leagueName?: string | null;
}): ScoreAxisExactLeagueWidget | null {
  const leagueInfo = getScoreAxisLeagueInfo(input);
  if (!leagueInfo) return null;
  return EXACT_SCOREAXIS_LEAGUE_TABLE_WIDGETS[leagueInfo.leagueKey] ?? null;
}

export function listExactScoreAxisLeagueTableWidgets(): ScoreAxisExactLeagueWidget[] {
  return [
    EXACT_SCOREAXIS_LEAGUE_TABLE_WIDGETS["english premier league"],
    EXACT_SCOREAXIS_LEAGUE_TABLE_WIDGETS["laliga spain"],
    EXACT_SCOREAXIS_LEAGUE_TABLE_WIDGETS["bundesliga germany"],
    EXACT_SCOREAXIS_LEAGUE_TABLE_WIDGETS["ligue 1 france"],
    EXACT_SCOREAXIS_LEAGUE_TABLE_WIDGETS["serie a italy"],
    EXACT_SCOREAXIS_LEAGUE_TABLE_WIDGETS["primeira liga portugal"],
    EXACT_SCOREAXIS_LEAGUE_TABLE_WIDGETS["super lig turkey"],
  ];
}

export function getScoreAxisLiveMatchId(
  externalApiId?: string | null
): string | null {
  if (!externalApiId) return null;
  return SCOREAXIS_MATCH_IDS_BY_EXTERNAL_API_ID[externalApiId] ?? null;
}

export function buildScoreAxisWidgetSrc(
  kind: ScoreAxisWidgetKind,
  entityId: string
): string {
  const searchParams = new URLSearchParams({
    ...SCOREAXIS_WIDGET_BASE_PARAMS,
    ...SCOREAXIS_WIDGET_PARAMS_BY_KIND[kind],
  });

  return `${SCOREAXIS_BASE_URL}/${kind}/${entityId}?${searchParams.toString()}`;
}
