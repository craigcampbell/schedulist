const db = require('../src/models');

async function createTeams() {
  try {
    console.log('Creating teams...');
    
    // Get BCBAs and therapists for Sunshine Therapy
    const sunshineOrg = await db.Organization.findOne({ where: { slug: 'sunshine' } });
    
    const bcbas = await db.User.findAll({
      include: [{
        model: db.Role,
        where: { name: 'bcba' },
        through: { attributes: [] }
      }],
      where: { organizationId: sunshineOrg.id }
    });
    
    const therapists = await db.User.findAll({
      include: [{
        model: db.Role,
        where: { name: 'therapist' },
        through: { attributes: [] }
      }],
      where: { organizationId: sunshineOrg.id }
    });
    
    console.log(`Found ${bcbas.length} BCBAs and ${therapists.length} therapists`);
    
    // Create teams with BCBAs as leads
    for (let i = 0; i < bcbas.length && i < 3; i++) { // Create up to 3 teams
      const bcba = bcbas[i];
      const teamName = `Team ${bcba.firstName}`;
      
      // Create team
      const team = await db.Team.create({
        name: teamName,
        leadBcbaId: bcba.id,
        organizationId: sunshineOrg.id,
        active: true
      });
      
      console.log(`Created team: ${teamName}`);
      
      // Assign 3-4 therapists to each team
      const teamSize = 3 + Math.floor(Math.random() * 2);
      const startIdx = i * 4;
      
      for (let j = 0; j < teamSize && startIdx + j < therapists.length; j++) {
        const therapist = therapists[startIdx + j];
        await team.addMember(therapist);
        console.log(`  - Added ${therapist.firstName} ${therapist.lastName} to ${teamName}`);
      }
    }
    
    // Create teams for other organizations too
    const heartsOrg = await db.Organization.findOne({ where: { slug: 'healing-hearts' } });
    const heartsBcba = await db.User.findOne({
      include: [{
        model: db.Role,
        where: { name: 'bcba' },
        through: { attributes: [] }
      }],
      where: { organizationId: heartsOrg.id }
    });
    
    if (heartsBcba) {
      const team = await db.Team.create({
        name: `Team ${heartsBcba.firstName}`,
        leadBcbaId: heartsBcba.id,
        organizationId: heartsOrg.id,
        active: true
      });
      
      const heartsTherapists = await db.User.findAll({
        include: [{
          model: db.Role,
          where: { name: 'therapist' },
          through: { attributes: [] }
        }],
        where: { organizationId: heartsOrg.id }
      });
      
      for (const therapist of heartsTherapists) {
        await team.addMember(therapist);
      }
      
      console.log(`Created team for Healing Hearts: Team ${heartsBcba.firstName}`);
    }
    
    console.log('\nTeams created successfully!');
    
  } catch (error) {
    console.error('Error creating teams:', error);
  } finally {
    await db.sequelize.close();
  }
}

createTeams();