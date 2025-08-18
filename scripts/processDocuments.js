import fs from 'fs';
import path from 'path';

const DATA_DIR = './data';

// Official USCIS 100 Civics Questions and Answers
const CIVICS_QUESTIONS = [
  // AMERICAN GOVERNMENT - A: Principles of American Democracy
  {
    id: 1,
    question: "What is the supreme law of the land?",
    answer: "the Constitution",
    category: "Principles of Democracy"
  },
  {
    id: 2,
    question: "What does the Constitution do?",
    answer: "sets up the government, defines the government, protects basic rights of Americans",
    category: "Principles of Democracy"
  },
  {
    id: 3,
    question: "The idea of self-government is in the first three words of the Constitution. What are these words?",
    answer: "We the People",
    category: "Principles of Democracy"
  },
  {
    id: 4,
    question: "What is an amendment?",
    answer: "a change to the Constitution, an addition to the Constitution",
    category: "Principles of Democracy"
  },
  {
    id: 5,
    question: "What do we call the first ten amendments to the Constitution?",
    answer: "the Bill of Rights",
    category: "Principles of Democracy"
  },
  {
    id: 6,
    question: "What is one right or freedom from the First Amendment?",
    answer: "speech, religion, assembly, press, petition the government",
    category: "Principles of Democracy"
  },
  {
    id: 7,
    question: "How many amendments does the Constitution have?",
    answer: "twenty-seven (27)",
    category: "Principles of Democracy"
  },
  {
    id: 8,
    question: "What did the Declaration of Independence do?",
    answer: "announced our independence from Great Britain, declared our independence from Great Britain, said that the United States is free from Great Britain",
    category: "Principles of Democracy"
  },
  {
    id: 9,
    question: "What are two rights in the Declaration of Independence?",
    answer: "life, liberty, pursuit of happiness",
    category: "Principles of Democracy"
  },
  {
    id: 10,
    question: "What is freedom of religion?",
    answer: "You can practice any religion, or not practice a religion",
    category: "Principles of Democracy"
  },
  {
    id: 11,
    question: "What is the economic system in the United States?",
    answer: "capitalist economy, market economy",
    category: "Principles of Democracy"
  },
  {
    id: 12,
    question: "What is the rule of law?",
    answer: "Everyone must follow the law, Leaders must obey the law, Government must obey the law, No one is above the law",
    category: "Principles of Democracy"
  },
  
  // AMERICAN GOVERNMENT - B: System of Government
  {
    id: 13,
    question: "Name one branch or part of the government.",
    answer: "Congress, legislative, President, executive, the courts, judicial",
    category: "System of Government"
  },
  {
    id: 14,
    question: "What stops one branch of government from becoming too powerful?",
    answer: "checks and balances, separation of powers",
    category: "System of Government"
  },
  {
    id: 15,
    question: "Who is in charge of the executive branch?",
    answer: "the President",
    category: "System of Government"
  },
  {
    id: 16,
    question: "Who makes federal laws?",
    answer: "Congress, Senate and House of Representatives, U.S. or national legislature",
    category: "System of Government"
  },
  {
    id: 17,
    question: "What are the two parts of the U.S. Congress?",
    answer: "the Senate and House of Representatives",
    category: "System of Government"
  },
  {
    id: 18,
    question: "How many U.S. Senators are there?",
    answer: "one hundred (100)",
    category: "System of Government"
  },
  {
    id: 19,
    question: "We elect a U.S. Senator for how many years?",
    answer: "six (6)",
    category: "System of Government"
  },
  {
    id: 20,
    question: "Who is one of your state's U.S. Senators now?",
    answer: "Answers will vary. [Visit senate.gov for your state's current Senators.]",
    category: "System of Government"
  },
  {
    id: 21,
    question: "The House of Representatives has how many voting members?",
    answer: "four hundred thirty-five (435)",
    category: "System of Government"
  },
  {
    id: 22,
    question: "We elect a U.S. Representative for how many years?",
    answer: "two (2)",
    category: "System of Government"
  },
  {
    id: 23,
    question: "Name your U.S. Representative.",
    answer: "Answers will vary. [Residents of territories with nonvoting Delegates or Resident Commissioners may provide the name of that Delegate or Commissioner. Also acceptable is any statement that the territory has no (voting) Representatives in Congress.]",
    category: "System of Government"
  },
  {
    id: 24,
    question: "Who does a U.S. Senator represent?",
    answer: "all people of the state",
    category: "System of Government"
  },
  {
    id: 25,
    question: "Why do some states have more Representatives than other states?",
    answer: "because of the state's population, because they have more people, because some states have more people",
    category: "System of Government"
  },
  {
    id: 26,
    question: "We elect a President for how many years?",
    answer: "four (4)",
    category: "System of Government"
  },
  {
    id: 27,
    question: "In what month do we vote for President?",
    answer: "November",
    category: "System of Government"
  },
  {
    id: 28,
    question: "What is the name of the President of the United States now?",
    answer: "Donald Trump",
    category: "System of Government"
  },
  {
    id: 29,
    question: "What is the name of the Vice President of the United States now?",
    answer: "J.D. Vance",
    category: "System of Government"
  },
  {
    id: 30,
    question: "If the President can no longer serve, who becomes President?",
    answer: "the Vice President",
    category: "System of Government"
  },
  {
    id: 31,
    question: "If both the President and the Vice President can no longer serve, who becomes President?",
    answer: "the Speaker of the House",
    category: "System of Government"
  },
  {
    id: 32,
    question: "Who is the Commander in Chief of the military?",
    answer: "the President",
    category: "System of Government"
  },
  {
    id: 33,
    question: "Who signs bills to become laws?",
    answer: "the President",
    category: "System of Government"
  },
  {
    id: 34,
    question: "Who vetoes bills?",
    answer: "the President",
    category: "System of Government"
  },
  {
    id: 35,
    question: "What does the President's Cabinet do?",
    answer: "advises the President",
    category: "System of Government"
  },
  {
    id: 36,
    question: "What are two Cabinet-level positions?",
    answer: "Secretary of Agriculture, Secretary of Commerce, Secretary of Defense, Secretary of Education, Secretary of Energy, Secretary of Health and Human Services, Secretary of Homeland Security, Secretary of Housing and Urban Development, Secretary of the Interior, Secretary of Labor, Secretary of State, Secretary of Transportation, Secretary of the Treasury, Secretary of Veterans Affairs, Attorney General, Vice President",
    category: "System of Government"
  },
  {
    id: 37,
    question: "What does the judicial branch do?",
    answer: "reviews laws, explains laws, resolves disputes (disagreements), decides if a law goes against the Constitution",
    category: "System of Government"
  },
  {
    id: 38,
    question: "What is the highest court in the United States?",
    answer: "the Supreme Court",
    category: "System of Government"
  },
  {
    id: 39,
    question: "How many justices are on the Supreme Court?",
    answer: "nine (9)",
    category: "System of Government"
  },
  {
    id: 40,
    question: "Who is the Chief Justice of the United States now?",
    answer: "John Roberts (John G. Roberts, Jr.)",
    category: "System of Government"
  },
  {
    id: 41,
    question: "Under our Constitution, some powers belong to the federal government. What is one power of the federal government?",
    answer: "to print money, to declare war, to create an army, to make treaties",
    category: "System of Government"
  },
  {
    id: 42,
    question: "Under our Constitution, some powers belong to the states. What is one power of the states?",
    answer: "provide schooling and education, provide protection (police), provide safety (fire departments), give a driver's license, approve zoning and land use",
    category: "System of Government"
  },
  {
    id: 43,
    question: "Who is the Governor of your state now?",
    answer: "Answers will vary. [District of Columbia residents should answer that D.C. does not have a Governor.]",
    category: "System of Government"
  },
  {
    id: 44,
    question: "What is the capital of your state?",
    answer: "Answers will vary. [District of Columbia residents should answer that D.C. is not a state and does not have a capital. Residents of U.S. territories should name the capital of the territory.]",
    category: "System of Government"
  },
  {
    id: 45,
    question: "What are the two major political parties in the United States?",
    answer: "Democratic and Republican",
    category: "System of Government"
  },
  {
    id: 46,
    question: "What is the political party of the President now?",
    answer: "Republican (Party)",
    category: "System of Government"
  },
  {
    id: 47,
    question: "What is the name of the Speaker of the House of Representatives now?",
    answer: "Mike Johnson",
    category: "System of Government"
  },

  // AMERICAN GOVERNMENT - C: Rule of Law
  {
    id: 48,
    question: "There are four amendments to the Constitution about who can vote. Describe one of them.",
    answer: "Citizens eighteen (18) and older (can vote), You don't have to pay (a poll tax) to vote, Any citizen can vote. (Women and men can vote.), A male citizen of any race (can vote)",
    category: "Rule of Law"
  },
  {
    id: 49,
    question: "What is one responsibility that is only for United States citizens?",
    answer: "serve on a jury, vote in a federal election",
    category: "Rule of Law"
  },
  {
    id: 50,
    question: "Name one right only for United States citizens.",
    answer: "vote in a federal election, run for federal office",
    category: "Rule of Law"
  },
  {
    id: 51,
    question: "What are two rights of everyone living in the United States?",
    answer: "freedom of expression, freedom of speech, freedom of assembly, freedom to petition the government, freedom of religion, the right to bear arms",
    category: "Rule of Law"
  },
  {
    id: 52,
    question: "What do we show loyalty to when we say the Pledge of Allegiance?",
    answer: "the United States, the flag",
    category: "Rule of Law"
  },
  {
    id: 53,
    question: "What is one promise you make when you become a United States citizen?",
    answer: "give up loyalty to other countries, defend the Constitution and laws of the United States, obey the laws of the United States, serve in the U.S. military (if needed), serve (do important work for) the nation (if needed), be loyal to the United States",
    category: "Rule of Law"
  },
  {
    id: 54,
    question: "How old do citizens have to be to vote for President?",
    answer: "eighteen (18) and older",
    category: "Rule of Law"
  },
  {
    id: 55,
    question: "What are two ways that Americans can participate in their democracy?",
    answer: "vote, join a political party, help with a campaign, join a civic group, join a community group, give an elected official your opinion on an issue, call Senators and Representatives, publicly support or oppose an issue or policy, run for office, write to a newspaper",
    category: "Rule of Law"
  },
  {
    id: 56,
    question: "When is the last day you can send in federal income tax forms?",
    answer: "April 15",
    category: "Rule of Law"
  },
  {
    id: 57,
    question: "When must all men register for the Selective Service?",
    answer: "at age eighteen (18), between eighteen (18) and twenty-six (26)",
    category: "Rule of Law"
  },

  // AMERICAN HISTORY - A: Colonial Period and Independence
  {
    id: 58,
    question: "What is one reason colonists came to America?",
    answer: "freedom, political liberty, religious freedom, economic opportunity, practice their religion, escape persecution",
    category: "Colonial Period and Independence"
  },
  {
    id: 59,
    question: "Who lived in America before the Europeans arrived?",
    answer: "American Indians, Native Americans",
    category: "Colonial Period and Independence"
  },
  {
    id: 60,
    question: "What group of people was taken to America and sold as slaves?",
    answer: "Africans, people from Africa",
    category: "Colonial Period and Independence"
  },
  {
    id: 61,
    question: "Why did the colonists fight the British?",
    answer: "because of high taxes (taxation without representation), because the British army stayed in their houses (boarding, quartering), because they didn't have self-government",
    category: "Colonial Period and Independence"
  },
  {
    id: 62,
    question: "Who wrote the Declaration of Independence?",
    answer: "(Thomas) Jefferson",
    category: "Colonial Period and Independence"
  },
  {
    id: 63,
    question: "When was the Declaration of Independence adopted?",
    answer: "July 4, 1776",
    category: "Colonial Period and Independence"
  },
  {
    id: 64,
    question: "There were 13 original states. Name three.",
    answer: "New Hampshire, Massachusetts, Rhode Island, Connecticut, New York, New Jersey, Pennsylvania, Delaware, Maryland, Virginia, North Carolina, South Carolina, Georgia",
    category: "Colonial Period and Independence"
  },
  {
    id: 65,
    question: "What happened at the Constitutional Convention?",
    answer: "The Constitution was written, The Founding Fathers wrote the Constitution",
    category: "Colonial Period and Independence"
  },
  {
    id: 66,
    question: "When was the Constitution written?",
    answer: "1787",
    category: "Colonial Period and Independence"
  },
  {
    id: 67,
    question: "The Federalist Papers supported the passage of the U.S. Constitution. Name one of the writers.",
    answer: "(James) Madison, (Alexander) Hamilton, (John) Jay, Publius",
    category: "Colonial Period and Independence"
  },
  {
    id: 68,
    question: "What is one thing Benjamin Franklin is famous for?",
    answer: "U.S. diplomat, oldest member of the Constitutional Convention, first Postmaster General of the United States, writer of \"Poor Richard's Almanac\", started the first free libraries",
    category: "Colonial Period and Independence"
  },
  {
    id: 69,
    question: "Who is the \"Father of Our Country\"?",
    answer: "(George) Washington",
    category: "Colonial Period and Independence"
  },
  {
    id: 70,
    question: "Who was the first President?",
    answer: "(George) Washington",
    category: "Colonial Period and Independence"
  },

  // AMERICAN HISTORY - B: Independence
  {
    id: 71,
    question: "What territory did the United States buy from France in 1803?",
    answer: "the Louisiana Territory, Louisiana",
    category: "Independence"
  },
  {
    id: 72,
    question: "Name one war fought by the United States in the 1800s.",
    answer: "War of 1812, Mexican-American War, Civil War, Spanish-American War",
    category: "Independence"
  },
  {
    id: 73,
    question: "Name the U.S. war between the North and the South.",
    answer: "the Civil War, the War between the States",
    category: "Independence"
  },
  {
    id: 74,
    question: "Name one problem that led to the Civil War.",
    answer: "slavery, economic reasons, states' rights",
    category: "Independence"
  },
  {
    id: 75,
    question: "What was one important thing that Abraham Lincoln did?",
    answer: "freed the slaves (Emancipation Proclamation), saved (or preserved) the Union, led the United States during the Civil War",
    category: "Independence"
  },
  {
    id: 76,
    question: "What did the Emancipation Proclamation do?",
    answer: "freed the slaves, freed slaves in the Confederacy, freed slaves in the Confederate states, freed slaves in most Southern states",
    category: "Independence"
  },
  {
    id: 77,
    question: "What did Susan B. Anthony do?",
    answer: "fought for women's rights, fought for civil rights",
    category: "Independence"
  },

  // AMERICAN HISTORY - C: 1900s
  {
    id: 78,
    question: "Name one war fought by the United States in the 1900s.",
    answer: "World War I, World War II, Korean War, Vietnam War, (Persian) Gulf War",
    category: "1900s"
  },
  {
    id: 79,
    question: "Who was President during World War I?",
    answer: "(Woodrow) Wilson",
    category: "1900s"
  },
  {
    id: 80,
    question: "Who was President during the Great Depression and World War II?",
    answer: "(Franklin) Roosevelt",
    category: "1900s"
  },
  {
    id: 81,
    question: "Who did the United States fight in World War II?",
    answer: "Japan, Germany, and Italy",
    category: "1900s"
  },
  {
    id: 82,
    question: "Before he was President, Eisenhower was a general. What war was he in?",
    answer: "World War II",
    category: "1900s"
  },
  {
    id: 83,
    question: "During the Cold War, what was the main concern of the United States?",
    answer: "Communism",
    category: "1900s"
  },
  {
    id: 84,
    question: "What movement tried to end racial discrimination?",
    answer: "civil rights (movement)",
    category: "1900s"
  },
  {
    id: 85,
    question: "What did Martin Luther King, Jr. do?",
    answer: "fought for civil rights, worked for equality for all Americans",
    category: "1900s"
  },
  {
    id: 86,
    question: "What major event happened on September 11, 2001, in the United States?",
    answer: "Terrorists attacked the United States",
    category: "1900s"
  },
  {
    id: 87,
    question: "Name one American Indian tribe in the United States.",
    answer: "Cherokee, Navajo, Sioux, Chippewa, Choctaw, Pueblo, Apache, Iroquois, Creek, Blackfeet, Seminole, Cheyenne, Arawak, Shawnee, Mohegan, Huron, Oneida, Lakota, Crow, Teton, Hopi, Inuit",
    category: "1900s"
  },

  // INTEGRATED CIVICS - A: Geography
  {
    id: 88,
    question: "Name one of the two longest rivers in the United States.",
    answer: "Missouri (River), Mississippi (River)",
    category: "Geography"
  },
  {
    id: 89,
    question: "What ocean is on the West Coast of the United States?",
    answer: "Pacific (Ocean)",
    category: "Geography"
  },
  {
    id: 90,
    question: "What ocean is on the East Coast of the United States?",
    answer: "Atlantic (Ocean)",
    category: "Geography"
  },
  {
    id: 91,
    question: "Name one U.S. territory.",
    answer: "Puerto Rico, U.S. Virgin Islands, American Samoa, Northern Mariana Islands, Guam",
    category: "Geography"
  },
  {
    id: 92,
    question: "Name one state that borders Canada.",
    answer: "Maine, New Hampshire, Vermont, New York, Pennsylvania, Ohio, Michigan, Minnesota, North Dakota, Montana, Idaho, Washington, Alaska",
    category: "Geography"
  },
  {
    id: 93,
    question: "Name one state that borders Mexico.",
    answer: "California, Arizona, New Mexico, Texas",
    category: "Geography"
  },
  {
    id: 94,
    question: "What is the capital of the United States?",
    answer: "Washington, D.C.",
    category: "Geography"
  },
  {
    id: 95,
    question: "Where is the Statue of Liberty?",
    answer: "New York (Harbor), Liberty Island, [Also acceptable are New Jersey, near New York City, and on the Hudson (River).]",
    category: "Geography"
  },

  // INTEGRATED CIVICS - B: Symbols
  {
    id: 96,
    question: "Why does the flag have 13 stripes?",
    answer: "because there were 13 original colonies, because the stripes represent the original colonies",
    category: "Symbols"
  },
  {
    id: 97,
    question: "Why does the flag have 50 stars?",
    answer: "because there is one star for each state, because each star represents a state, because there are 50 states",
    category: "Symbols"
  },
  {
    id: 98,
    question: "What is the name of the national anthem?",
    answer: "The Star-Spangled Banner",
    category: "Symbols"
  },

  // INTEGRATED CIVICS - C: Holidays
  {
    id: 99,
    question: "When do we celebrate Independence Day?",
    answer: "July 4",
    category: "Holidays"
  },
  {
    id: 100,
    question: "Name two national U.S. holidays.",
    answer: "New Year's Day, Martin Luther King, Jr. Day, Presidents' Day, Memorial Day, Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving, Christmas",
    category: "Holidays"
  }
];

// Add more questions (this is a subset for demo - in real implementation you'd have all 100)
function getAllCivicsQuestions() {
  return CIVICS_QUESTIONS.map(q => ({
    ...q,
    content: `Question ${q.id}: ${q.question}\nAnswer: ${q.answer}`
  }));
}

async function processUSCISDocuments() {
  console.log('🔄 Processing USCIS documents...');
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  try {
    console.log('🧠 Loading civics questions...');
    const questions = getAllCivicsQuestions();
    
    console.log(`✅ Loaded ${questions.length} questions`);
    
    // Save processed data
    const outputPath = path.join(DATA_DIR, 'processed-questions.json');
    fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2));
    
    console.log(`💾 Saved processed questions to ${outputPath}`);
    
    // Print sample for verification
    console.log('\n📋 Sample questions:');
    questions.slice(0, 3).forEach(q => {
      console.log(`\n${q.id}. ${q.question}`);
      console.log(`   Answer: ${q.answer.substring(0, 100)}${q.answer.length > 100 ? '...' : ''}`);
      console.log(`   Category: ${q.category}`);
    });
    
    return questions;
  } catch (error) {
    console.error('❌ Error processing documents:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processUSCISDocuments().catch(console.error);
}

export { processUSCISDocuments };