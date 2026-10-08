export const ACTS = {
  1: { name: 'Проклятое кладбище', bgs: ['graveyard', 'forest'],
    pool: ['skeleton', 'skeleton_archer', 'zombie', 'cultist', 'ghoul', 'crow_swarm', 'wolf_dire', 'bone_hound', 'grave_robber', 'wraith'],
    elites: ['bone_knight', 'cult_priest', 'dire_alpha'], bosses: ['gravewarden', 'lich_apprentice'], bossBg: 'crypt' },
  2: { name: 'Багровый замок', bgs: ['castle', 'crypt'],
    pool: ['vampire_thrall', 'gargoyle', 'haunted_armor', 'bat_swarm', 'blood_mage', 'werewolf', 'spider_giant', 'plague_doctor', 'executioner', 'banshee'],
    elites: ['blood_knight', 'gargoyle_elder', 'crimson_witch'], bosses: ['countess', 'hollow_king'], bossBg: 'castle' },
  3: { name: 'Бездна', bgs: ['hell', 'void'],
    pool: ['imp', 'hellhound', 'demon_brute', 'succubus', 'fire_elemental', 'obsidian_golem', 'chaos_cultist', 'abyss_eye', 'shadow_stalker', 'horned_knight'],
    elites: ['hell_champion', 'void_priest', 'obsidian_titan'], bosses: ['archdemon', 'void_dragon'], bossBg: 'void' },
};
export const FLOORS_PER_ACT = 10;
