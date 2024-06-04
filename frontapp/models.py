from django.contrib.auth.models import AbstractUser ,Group, Permission
from django.db import models
from django.db.models import JSONField


class CustomUser(AbstractUser):
    display_name = models.CharField(max_length=255, null=True, blank=True)
    avatar = models.URLField(max_length=200, null=True, blank=True)
    stats = JSONField(default=dict)  # custom struct for user stats
    match_history = JSONField(default=list)  # array of custom structs for match history
    two_factor_auth_enabled = models.BooleanField(default=False)
    
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='customuser_set',
        blank=True,
        help_text='The groups this user belongs to.',
        verbose_name='groups'
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='customuser_set',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions'
    )
    #Friendship Functions

    def get_friends(self):
        # Get all friendships where the friend request has been accepted
        accepted_friendships = self.friendships_sent.filter(accepted=True) | self.friendships_received.filter(accepted=True)
        
        # Get the friends from the friendships
        friends = [friendship.to_user for friendship in accepted_friendships if friendship.to_user != self] + \
                [friendship.from_user for friendship in accepted_friendships if friendship.from_user != self]
        
        return friends

    def get_friend_names(self):
        
        accepted_friendships = self.friendships_sent.filter(accepted=True) | self.friendships_received.filter(accepted=True)
        
        
        friend_names = [friendship.to_user.display_name for friendship in accepted_friendships if friendship.to_user != self] + \
                       [friendship.from_user.display_name for friendship in accepted_friendships if friendship.from_user != self]
        
        return friend_names
    
    # ----------------------------
    
    def __str__(self):
        return self.username

    class Meta:
        db_table = 'auth_user'


class CustomUserGroup(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)

class CustomUserPermission(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

class Friendship(models.Model):
    from_user = models.ForeignKey(CustomUser, related_name='friendships_sent', on_delete=models.CASCADE)
    to_user = models.ForeignKey(CustomUser, related_name='friendships_received', on_delete=models.CASCADE)
    accepted = models.BooleanField(default=False)

    class Meta:
        unique_together = ('from_user', 'to_user')