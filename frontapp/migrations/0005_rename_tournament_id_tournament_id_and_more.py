# Generated by Django 4.2.13 on 2024-06-27 11:26

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('frontapp', '0004_tournament'),
    ]

    operations = [
        migrations.RenameField(
            model_name='tournament',
            old_name='tournament_id',
            new_name='id',
        ),
        migrations.RenameField(
            model_name='tournament',
            old_name='size',
            new_name='number_of_players',
        ),
    ]
