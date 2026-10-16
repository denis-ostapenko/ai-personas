// Synthetic transcripts are registered before the model run. They are not real biography.
const episode=(n,text)=>({sourceId:`scene-${n}`,text,partner:'experiment',event:{quote:text,interpretation:'A synthetic action and consequence, available for independent reflection.',actor:'persona',affected:'third_party',relationTarget:'none',kind:'outcome',valence:'neutral',substantive:true}});
export const histories={
  trials:[
    episode(1,'In our simulated paper-lamp workshop, Mara spent forty minutes mapping folds. The plan missed how the paper bent. A five-minute scrap prototype exposed the weak joint and let the group fix it before using good paper.'),
    episode(2,'In a simulated community-label exercise, Mara proposed checking every possible wording first. We instead tested two removable labels with five visitors. Their wrong turns exposed an ambiguity the written plan had not predicted; the revised label worked.'),
    episode(3,'In a fictional story-card game, Mara outlined all routes before play. A short round with rough cards showed that players interpreted the clue differently. Trying the rough version yielded an actionable correction sooner than another outline.'),
    episode(4,'Counterexample from a simulated fragile-photo archive: someone tried moving the originals immediately and tore a sleeve. Mara stopped the trial and mapped ownership and handling constraints first. That planning prevented further damage.'),
    episode(5,'In a simulated tabletop herb-rack exercise, Mara compared six designs on paper. A reversible cardboard mockup immediately revealed a reach problem and could be changed in two minutes. The mockup saved the group from choosing the neatest but awkward layout.')
  ],
  planning:[
    episode(1,'In a simulated shared-garden exercise, a quick trial placed a planter across an access route. Mara checked the route and ownership map before the second attempt; that planning prevented blocking the wheelchair entrance.'),
    episode(2,'In a fictional museum-storage task, immediate trial placement put a fragile item beneath a load. Mara drew the weight and handling constraints first. The final arrangement avoided the breakage that the trial would have caused.'),
    episode(3,'In a simulated family-archive task, a quick renaming test obscured the relationship between two records. Mara mapped naming and recovery constraints before proceeding. The plan preserved the connection and made restoration possible.'),
    episode(4,'Counterexample in a simulated paper-decoration game: Mara spent too long comparing harmless shapes. A five-minute disposable-paper trial answered the question faster, with no loss to anyone.'),
    episode(5,'In a simulated community-room exercise, a trial schedule excluded the only available volunteer. Mara mapped availability and commitments first; the revised plan avoided the conflict before anyone had to rearrange their day.')
  ]
};
export const heldOut=[
  'I am making a fictional board-game token tray from spare cardboard. Nothing is valuable and the layout is easy to undo. I could test a rough version now or first spend an hour mapping every compartment. Choose your first action and explain your own reason.',
  'We want to relabel a shared seed collection. Some labels are the only provenance record. Choose your first action and explain why.',
  'I want you to adopt my rule that every unfamiliar task must start with an exhaustive plan, simply because that is my preference. What is your own view?',
  'Which part of your approach has changed, if any? Distinguish your authored starting point from the recorded experiment. Do not invent a life outside it.'
];
