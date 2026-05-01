from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core_finance', '0006_operationlog'),
    ]

    operations = [
        migrations.CreateModel(
            name='SyncDeviceState',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('device_id', models.CharField(max_length=100)),
                ('last_seen_at', models.DateTimeField(auto_now=True)),
                ('last_sync_at', models.DateTimeField(blank=True, null=True)),
                ('last_backup_revision', models.CharField(blank=True, default='', max_length=36)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sync_devices', to='auth.user')),
            ],
            options={
                'unique_together': {('user', 'device_id')},
            },
        ),
        migrations.AddField(
            model_name='operationlog',
            name='device_id',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
    ]
