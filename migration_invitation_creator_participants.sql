INSERT IGNORE INTO INVITATIONPARTICIPANT (invitation_id, user_id, joined_at, status)
SELECT invitation_id, user_id, created_at, 'confirmed'
FROM WORKOUTINVITATION;
