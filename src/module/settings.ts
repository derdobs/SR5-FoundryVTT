// game settings for shadowrun 5e

import { VersionMigration } from './migrator/VersionMigration';
import { FLAGS, SYSTEM_NAME } from './constants';

export const registerSystemSettings = () => {
    /**
     * Register diagonal movement rule setting
     */
    game.settings.register(SYSTEM_NAME, 'diagonalMovement', {
        name: 'SETTINGS.DiagonalMovementName',
        hint: 'SETTINGS.DiagonalMovementDescription',
        scope: 'world',
        config: true,
        type: String,
        default: '1-2-1',
        choices: {
            '1-1-1': 'SETTINGS.IgnoreDiagonal',
            '1-2-1': 'SETTINGS.EstimateDiagonal',
            'EUCL': 'SETTINGS.Euclidean',
        },
        onChange: (rule) => {
            if (canvas.ready){
                // @ts-ignore // TODO: foundry-vtt-types diagonalRule doesn't exist anymore. Is it even working?
                canvas.grid.diagonalRule = rule
            }
        },
    });

    /**
     * Default limit behavior
     */
    game.settings.register(SYSTEM_NAME, 'applyLimits', {
        name: 'SETTINGS.ApplyLimitsName',
        hint: 'SETTINGS.ApplyLimitsDescription',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(SYSTEM_NAME, 'displayDefaultRollCard', {
        name: 'SETTINGS.DisplayDefaultRollCardName',
        hint: 'SETTINGS.DisplayDefaultRollCardDescription',
        scope: 'user',
        config: true,
        type: Boolean,
        default: false,
    });

    /**
     * Track system version upon which a migration was last applied
     */
    game.settings.register(SYSTEM_NAME, VersionMigration.KEY_DATA_VERSION, {
        name: 'System Data Version.',
        scope: 'world',
        config: false,
        type: String,
        default: '0',
    });

    game.settings.register(SYSTEM_NAME, FLAGS.ShowGlitchAnimation, {
        name: 'SETTINGS.ShowGlitchAnimationName',
        hint: 'SETTINGS.ShowGlitchAnimationDescription',
        scope: 'user',
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(SYSTEM_NAME, FLAGS.ShowTokenNameForChatOutput, {
        name: 'SETTINGS.ShowTokenNameForChatOutputName',
        hint: 'SETTINGS.ShowTokenNameForChatOutputDescription',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(SYSTEM_NAME, FLAGS.WhisperOpposedTestsToTargetedPlayers, {
        name: 'SETTINGS.WhisperOpposedTestsToTargetedPlayers',
        hint: 'SETTINGS.WhisperOpposedTestsToTargetedPlayersDescription',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(SYSTEM_NAME, FLAGS.OnlyAllowRollOnDefaultableSkills, {
         name: 'SETTINGS.OnlyAllowRollOnDefaultableSkills',
        hint: 'SETTINGS.OnlyAllowRollOnDefaultableSkillsDescription',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(SYSTEM_NAME, FLAGS.ShowSkillsWithDetails, {
         name: 'SETTINGS.ShowSkillsWithDetails',
        hint: 'SETTINGS.ShowSkillsWithDetailsDescription',
        scope: 'user',
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(SYSTEM_NAME, FLAGS.OnlyAutoRollNPCInCombat, {
         name: 'SETTINGS.OnlyAutoRollNPCInCombat',
        hint: 'SETTINGS.OnlyAutoRollNPCInCombatDescription',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(SYSTEM_NAME, FLAGS.TokenHealthBars, {
        name: 'SETTINGS.TokenHealthBars',
        hint: 'SETTINGS.TokenHealthBarsDescription',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
    });
};
