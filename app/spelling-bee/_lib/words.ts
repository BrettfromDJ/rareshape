import type { Difficulty, Word } from './types'

type Row = [word: string, pos: string, definition: string, sentence: string, pronunciation?: string]

const slug = (word: string): string =>
  word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export const wordId = (word: string): string => `w-${slug(word)}`

const EASY: Row[] = [
  ['Definitely', 'adverb', 'Without doubt; certainly.', 'Brett definitely knows how to spell this one, he said, moments before it got an A in it.', 'DEF-uh-nit-lee'],
  ['Separate', 'verb', 'To divide or keep apart.', 'Please separate the potato salad from the fireworks before anyone gets hurt.', 'SEP-uh-rate'],
  ['Restaurant', 'noun', 'A place where people pay to sit down and eat.', 'The restaurant politely asked Uncle Rick to stop rating the bread on a ten-point scale.', 'RES-tuh-rahnt'],
  ['Calendar', 'noun', 'A chart showing the days, weeks and months of a year.', 'According to the calendar, Dana has been "about to start running" since 2019.', 'KAL-en-der'],
  ['Vacuum', 'noun', 'A space with nothing in it; also a machine that sucks up dirt.', 'Brett experienced considerable embarrassment after confidently spelling vacuum with three U\'s.', 'VAK-yoom'],
  ['Tomorrow', 'noun', 'The day after today.', 'Tomorrow is when Meg will finally return the lawn chair she borrowed in 2021.', 'tuh-MOR-oh'],
  ['Address', 'noun', 'The details of where someone lives.', 'The pizza never came because Tyler gave the driver the address of his feelings.', 'AD-dress'],
  ['Business', 'noun', 'Commercial activity; a company.', 'Grandpa Joe\'s new business sells "vintage" items he found in the garage yesterday.', 'BIZ-nis'],
  ['Beginning', 'noun', 'The point at which something starts.', 'In the beginning there was one cooler, and then Aunt Carol arrived with four more.', 'bih-GIN-ing'],
  ['Wednesday', 'noun', 'The day between Tuesday and Thursday.', 'Every Wednesday, Dana insists it is "basically the weekend."', 'WENZ-day'],
  ['February', 'noun', 'The second month of the year.', 'Tyler claims he was born in February, which explains nothing but he keeps saying it.', 'FEB-roo-air-ee'],
  ['Jewelry', 'noun', 'Decorative items worn on the body, like rings and necklaces.', 'Aunt Carol\'s jewelry is louder than the band and has better rhythm.', 'JOOL-ree'],
  ['Argument', 'noun', 'A disagreement; also a reason given in support of something.', 'The argument about whether a hot dog is a sandwich has now entered its ninth year.', 'AR-gyoo-ment'],
  ['Believe', 'verb', 'To accept something as true.', 'Meg does not believe in ghosts, but she also will not go into the barn after dark.', 'bih-LEEV'],
  ['Receive', 'verb', 'To be given or presented with something.', 'Brett was thrilled to receive a trophy, then noticed it said "Participant."', 'rih-SEEV'],
  ['Weird', 'adjective', 'Strange or unusual.', 'It is weird that the dog only barks at people wearing sandals.', 'WEERD'],
  ['Grateful', 'adjective', 'Feeling or showing thanks.', 'We are grateful that Uncle Rick brought his guitar and even more grateful that he forgot the strings.', 'GRAYT-ful'],
  ['Library', 'noun', 'A building holding books that people can borrow.', 'The library has politely stopped sending Tyler overdue notices and started sending prayers.', 'LY-brer-ee'],
  ['Neighbor', 'noun', 'A person living near another.', 'Our neighbor waves every morning, mostly because he wants his ladder back.', 'NAY-ber'],
  ['Truly', 'adverb', 'In a genuine or sincere way.', 'Dana is truly sorry for eating the last brownie, and truly would do it again.', 'TROO-lee'],
  ['Twelfth', 'adjective', 'Number twelve in a sequence.', 'This is Grandpa Joe\'s twelfth attempt to light the grill with a magnifying glass.', 'TWELFTH'],
  ['Achieve', 'verb', 'To successfully reach a goal.', 'Tyler hopes to achieve his dream of napping through an entire holiday.', 'uh-CHEEV'],
  ['Familiar', 'adjective', 'Well known from long association.', 'That familiar smell means Uncle Rick is "experimenting" with the smoker again.', 'fuh-MIL-yer'],
  ['Forty', 'noun', 'The number after thirty-nine.', 'Meg has turned forty three years in a row and plans to keep it up.', 'FOR-tee'],
]

const MEDIUM: Row[] = [
  ['Necessary', 'adjective', 'Required; essential.', 'Nobody agreed it was necessary to bring a fog machine, and yet here we are.', 'NES-uh-sair-ee'],
  ['Embarrass', 'verb', 'To make someone feel awkward or ashamed.', 'Dana tried not to embarrass her kids by dancing, and failed with great enthusiasm.', 'em-BAIR-us'],
  ['Occasion', 'noun', 'A particular event or time.', 'Brett wears the same shirt for every occasion, and the shirt has started to notice.', 'uh-KAY-zhun'],
  ['Recommend', 'verb', 'To suggest something as suitable or good.', 'I would not recommend Uncle Rick\'s jalapeño lemonade, and neither would his doctor.', 'rek-uh-MEND'],
  ['Maintenance', 'noun', 'The process of keeping something in good condition.', 'The pool is "under maintenance," which means Tyler dropped his phone in it.', 'MAIN-tuh-nunce'],
  ['Privilege', 'noun', 'A special right or advantage.', 'It is a privilege to sit in Grandpa Joe\'s chair, and also a mistake.', 'PRIV-uh-lij'],
  ['Guarantee', 'verb', 'To promise something with certainty.', 'Meg can guarantee the cake is gluten-free, because she ate the gluten separately.', 'gair-un-TEE'],
  ['Relevant', 'adjective', 'Closely connected to the matter at hand.', 'Aunt Carol\'s story about a 1987 cruise was interesting, if not exactly relevant.', 'REL-uh-vunt'],
  ['Convenient', 'adjective', 'Fitting well with one\'s needs; easy.', 'It was very convenient that Tyler\'s "injury" appeared right before dishes.', 'kun-VEEN-yunt'],
  ['Independent', 'adjective', 'Free from outside control; self-reliant.', 'The toddler is now fully independent, which mostly means he opens the fridge alone.', 'in-dih-PEN-dunt'],
  ['Successful', 'adjective', 'Achieving a desired aim.', 'The successful launch of the water balloon was ruined by its successful landing on Grandma.', 'suk-SES-ful'],
  ['Possession', 'noun', 'Something that is owned.', 'Brett\'s most prized possession is a foam finger from a game he did not attend.', 'puh-ZESH-un'],
  ['Committee', 'noun', 'A group appointed to make decisions.', 'The snack committee has met four times and produced only crumbs.', 'kuh-MIT-ee'],
  ['Harassment', 'noun', 'Aggressive pressure or intimidation.', 'The goose considers any attempt to walk near the pond to be harassment.', 'huh-RASS-munt'],
  ['Broccoli', 'noun', 'A green vegetable with a tree-like shape.', 'Tyler has hidden broccoli in a napkin at every family dinner since 1998.', 'BROK-uh-lee'],
  ['Camouflage', 'noun', 'A disguise that blends in with the surroundings.', 'Uncle Rick\'s camouflage shorts work perfectly, right up until he speaks.', 'KAM-uh-flahzh'],
  ['Handkerchief', 'noun', 'A square of cloth carried for wiping the face.', 'Grandpa Joe produced a handkerchief the size of a tablecloth and dabbed one eye.', 'HANG-ker-chif'],
  ['Acknowledge', 'verb', 'To accept or admit the existence of something.', 'Dana refuses to acknowledge that the "shortcut" added forty minutes.', 'ak-NOL-ij'],
  ['Amateur', 'noun', 'A person who does something for fun rather than as a job.', 'As an amateur meteorologist, Brett predicted sun and packed for a monsoon.', 'AM-uh-chur'],
  ['Cemetery', 'noun', 'A burial ground.', 'Meg gives a tour of the local cemetery that is, somehow, mostly about her ex.', 'SEM-uh-tair-ee'],
  ['Existence', 'noun', 'The state of being real or alive.', 'The existence of a second bag of chips has been confirmed and is being guarded.', 'eg-ZIS-tunce'],
  ['Noticeable', 'adjective', 'Easily seen or observed.', 'There was a noticeable pause after Tyler asked if the pool was "for swimming."', 'NOH-tiss-uh-bul'],
  ['Occurrence', 'noun', 'Something that happens; an event.', 'Aunt Carol losing her sunglasses on her head is a daily occurrence.', 'uh-KUR-unce'],
  ['Perseverance', 'noun', 'Continued effort despite difficulty.', 'It took real perseverance to finish Uncle Rick\'s chili, and a fair amount of milk.', 'pur-suh-VEER-unce'],
  ['Personnel', 'noun', 'The people employed by an organization.', 'Grill personnel are reminded that tongs are tools, not drumsticks.', 'pur-suh-NEL'],
  ['Pastime', 'noun', 'An activity done for enjoyment.', 'Dana\'s favorite pastime is telling people her favorite pastime is reading.', 'PASS-time'],
  ['Threshold', 'noun', 'A doorway; the point at which something begins.', 'Brett carried the cooler over the threshold like it was his bride.', 'THRESH-hold'],
  ['Misspell', 'verb', 'To spell a word incorrectly.', 'It would be extremely funny to misspell this particular word, so please don\'t.', 'mis-SPEL'],
  ['Playwright', 'noun', 'A person who writes plays.', 'Tyler calls himself a playwright because he once wrote a skit for the talent show.', 'PLAY-rite'],
]

const HARD: Row[] = [
  ['Accommodate', 'verb', 'To provide space for; to adapt to.', 'We could not accommodate Aunt Carol\'s request for a "quieter" fireworks show.', 'uh-KOM-uh-date'],
  ['Questionnaire', 'noun', 'A set of written questions used to gather information.', 'Meg made everyone fill out a questionnaire before she would share the dip recipe.', 'kwes-chun-AIR'],
  ['Conscience', 'noun', 'A person\'s inner sense of right and wrong.', 'Brett\'s conscience told him not to take the last rib, and then it fell asleep.', 'KON-shunce'],
  ['Conscious', 'adjective', 'Awake and aware of one\'s surroundings.', 'Tyler was technically conscious during the safety briefing.', 'KON-shus'],
  ['Exaggerate', 'verb', 'To make something seem larger or better than it is.', 'Uncle Rick would never exaggerate, which is why the fish was "roughly the size of a canoe."', 'eg-ZAJ-uh-rate'],
  ['Immediately', 'adverb', 'At once; without delay.', 'Dana said she would help immediately, and immediately went to get a snack.', 'ih-MEE-dee-it-lee'],
  ['Liaison', 'noun', 'A person who acts as a link between groups.', 'Grandpa Joe appointed himself liaison between the kids\' table and the cake.', 'lee-AY-zon'],
  ['Judgment', 'noun', 'The ability to make sensible decisions.', 'Against all judgment, Brett tried to jump the creek in flip-flops.', 'JUJ-munt'],
  ['Rhythm', 'noun', 'A strong, regular repeated pattern of movement or sound.', 'Aunt Carol has rhythm, and she has decided the whole party should know.', 'RITH-um'],
  ['Colonel', 'noun', 'A senior military officer.', 'Tyler calls the neighbor "the Colonel," though the man simply owns a lot of khakis.', 'KER-nul'],
  ['Receipt', 'noun', 'A written record that something has been paid for.', 'Meg keeps every receipt in a shoebox labeled "Evidence."', 'rih-SEET'],
  ['Supersede', 'verb', 'To take the place of something.', 'The new cooler will supersede the old cooler, which is now a planter.', 'soo-per-SEED'],
  ['Minuscule', 'adjective', 'Extremely small.', 'The portion of potato salad Dana left for everyone else was minuscule.', 'MIN-uh-skyool'],
  ['Pronunciation', 'noun', 'The way a word is spoken.', 'Uncle Rick\'s pronunciation of "quinoa" has caused at least two arguments.', 'pruh-nun-see-AY-shun'],
  ['Millennium', 'noun', 'A period of one thousand years.', 'It has felt like a millennium since Brett started telling this story.', 'mih-LEN-ee-um'],
  ['Mischievous', 'adjective', 'Playfully causing trouble.', 'The mischievous raccoon and the mischievous nephew have formed an alliance.', 'MIS-chuh-vus'],
  ['Pharaoh', 'noun', 'A ruler of ancient Egypt.', 'Grandpa Joe reclines in his lawn chair like a pharaoh awaiting grapes.', 'FAIR-oh'],
  ['Bureaucracy', 'noun', 'A system of government with many complicated rules.', 'Getting a second hot dog from Aunt Carol involves a surprising amount of bureaucracy.', 'byoo-ROK-ruh-see'],
  ['Diarrhea', 'noun', 'An unpleasant digestive condition.', 'Uncle Rick\'s mystery chili and diarrhea have been linked in at least three studies.', 'dy-uh-REE-uh'],
  ['Fluorescent', 'adjective', 'Very bright or glowing.', 'Tyler\'s fluorescent swim trunks are visible from the interstate.', 'floor-ESS-unt'],
  ['Maneuver', 'noun', 'A skillful movement or plan.', 'Dana\'s parking maneuver took eleven minutes and two spotters.', 'muh-NOO-ver'],
  ['Hemorrhage', 'verb', 'To lose something rapidly, especially blood or money.', 'Brett continues to hemorrhage money on lawn games nobody plays.', 'HEM-er-ij'],
  ['Silhouette', 'noun', 'The dark outline of someone against a lighter background.', 'The silhouette in the window was either Grandpa Joe or a very tall lamp.', 'sil-oo-ET'],
  ['Entrepreneur', 'noun', 'A person who starts a business.', 'The entrepreneur at the kids\' table is charging two dollars for "premium" lemonade.', 'on-truh-pruh-NUR'],
  ['Sacrilegious', 'adjective', 'Disrespectful toward something sacred.', 'Putting ketchup on Meg\'s brisket is considered sacrilegious in this household.', 'sak-ruh-LIJ-us'],
  ['Dumbbell', 'noun', 'A short bar with weights at each end.', 'Tyler brought a single dumbbell to the party for reasons he has not explained.', 'DUM-bel'],
  ['Idiosyncrasy', 'noun', 'A peculiar habit or way of behaving.', 'Aunt Carol\'s idiosyncrasy is naming each of the deviled eggs before serving them.', 'id-ee-oh-SING-kruh-see'],
  ['Lieutenant', 'noun', 'A military rank; a deputy.', 'Uncle Rick named himself lieutenant of the grill and demanded a salute.', 'loo-TEN-unt'],
  ['Connoisseur', 'noun', 'An expert judge in matters of taste.', 'Brett, a self-described connoisseur, rated the boxed wine "surprisingly oaky."', 'kon-uh-SUR'],
  ['Pneumonia', 'noun', 'A lung infection.', 'Dana warned that swimming in September leads to pneumonia, then cannonballed in.', 'noo-MOHN-yuh'],
  ['Ecstasy', 'noun', 'Overwhelming happiness.', 'Grandpa Joe reached a state of ecstasy when the dessert table opened.', 'EK-stuh-see'],
]

const NIGHTMARE: Row[] = [
  ['Onomatopoeia', 'noun', 'A word that imitates the sound it describes.', 'Tyler\'s favorite onomatopoeia is "splat," which is also his favorite parking technique.', 'on-uh-mat-uh-PEE-uh'],
  ['Worcestershire', 'noun', 'A savory sauce, and a county in England.', 'Uncle Rick has never once pronounced Worcestershire correctly, but he uses a lot of it.', 'WUSS-ter-sher'],
  ['Chrysanthemum', 'noun', 'A brightly colored flower.', 'Aunt Carol\'s hat had a chrysanthemum so large it needed its own chair.', 'krih-SAN-thuh-mum'],
  ['Archaeology', 'noun', 'The study of human history through excavation.', 'Cleaning out the garage became an archaeology project when we found a 1994 phone book.', 'ar-kee-OL-uh-jee'],
  ['Bougainvillea', 'noun', 'A climbing plant with brightly colored flowers.', 'Dana killed the bougainvillea within a week, which the plant probably saw coming.', 'boo-gun-VIL-ee-uh'],
  ['Conscientious', 'adjective', 'Careful and thorough.', 'Meg is so conscientious that she alphabetized the ice.', 'kon-shee-EN-shus'],
  ['Embarrassment', 'noun', 'A feeling of awkwardness or shame.', 'Brett experienced considerable embarrassment after confidently spelling vacuum with three U\'s.', 'em-BAIR-us-munt'],
  ['Hors d\'oeuvre', 'noun', 'A small savory appetizer.', 'Grandpa Joe ate every hors d\'oeuvre and then asked when the appetizers were coming.', 'or-DURV'],
  ['Paraphernalia', 'noun', 'Miscellaneous equipment for a particular activity.', 'Tyler\'s fishing paraphernalia fills two trucks and has caught one boot.', 'pair-uh-fer-NAIL-yuh'],
  ['Liquefy', 'verb', 'To make or become liquid.', 'Left in the sun, the ice cream cake began to liquefy along with everyone\'s patience.', 'LIK-wuh-fy'],
  ['Rhododendron', 'noun', 'A shrub with large, showy flowers.', 'Dana backed the car into the rhododendron and blamed the rhododendron.', 'roh-duh-DEN-drun'],
  ['Prerogative', 'noun', 'A right or privilege belonging to a particular person.', 'It is Aunt Carol\'s prerogative to rearrange everyone else\'s coolers.', 'prih-ROG-uh-tiv'],
  ['Daiquiri', 'noun', 'A cocktail made with rum and lime.', 'Uncle Rick\'s frozen daiquiri machine has been running since noon and so has Uncle Rick.', 'DAK-er-ee'],
  ['Mnemonic', 'noun', 'A device that helps you remember something.', 'Brett\'s mnemonic for the gate code is so complex he has to write it down.', 'nih-MON-ik'],
  ['Ophthalmologist', 'noun', 'An eye doctor.', 'The ophthalmologist confirmed that Grandpa Joe can see fine; he just chooses not to.', 'off-thal-MOL-uh-jist'],
  ['Reconnaissance', 'noun', 'A survey of an area to gather information.', 'Meg did some reconnaissance on the dessert table before committing to dinner.', 'rih-KON-uh-sunce'],
  ['Gobbledygook', 'noun', 'Language that is meaningless or hard to understand.', 'The instructions for the lawn game were pure gobbledygook, so Tyler made up rules.', 'GOB-ul-dee-gook'],
  ['Bourgeoisie', 'noun', 'The middle class, especially materialistic people.', 'Dana referred to the family with the boat as "the bourgeoisie" and then asked for a ride.', 'boor-zhwah-ZEE'],
]

function build(rows: Row[], difficulty: Difficulty): Word[] {
  return rows.map(([word, partOfSpeech, definition, sentence, pronunciation]) => ({
    id: wordId(word),
    word,
    difficulty,
    partOfSpeech,
    definition,
    sentence,
    ...(pronunciation ? { pronunciation } : {}),
  }))
}

/** The word bank the app ships with. Words the host adds are stored alongside. */
export function defaultWords(): Word[] {
  return [
    ...build(EASY, 'easy'),
    ...build(MEDIUM, 'medium'),
    ...build(HARD, 'hard'),
    ...build(NIGHTMARE, 'nightmare'),
  ]
}
