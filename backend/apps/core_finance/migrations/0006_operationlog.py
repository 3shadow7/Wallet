from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('core_finance', '0005_userincome_calculation_method_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='OperationLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('op_id', models.CharField(max_length=100)),
                ('resource', models.CharField(max_length=50)),
                ('op_type', models.CharField(max_length=20)),
                ('client_resource_id', models.CharField(blank=True, max_length=100, null=True)),
                ('resource_pk', models.IntegerField(blank=True, null=True)),
                ('result', models.JSONField(default=dict, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='operation_logs', to='auth.user')),
            ],
            options={
                'unique_together': {('user', 'op_id')},
            },
        ),
    ]
