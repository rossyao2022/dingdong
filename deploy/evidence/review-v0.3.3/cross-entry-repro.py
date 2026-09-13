import pytest
from conftest import sign_in, create_child
from ops_helpers import make_staff, ops_client, post_json
from dingdong_ca.core.models import Child

pytestmark = pytest.mark.django_db

def test_parent_edit_invalidates_ops_stale_revision(client):
    sign_in(client)
    data = create_child(client)
    child = Child.objects.get(pk=data['id'])
    old_revision = child.revision
    ops = ops_client(make_staff('operations'))
    response = client.patch('/api/v1/children/' + str(child.pk), {'name': '家长刚刚更正'}, format='json')
    assert response.status_code == 200
    response = post_json(ops, '/ops/api/children/' + str(child.pk), {'name': '运营旧页面称呼', 'gender':'unknown', 'birth_date':''}, revision=old_revision)
    child.refresh_from_db()
    assert response.status_code == 409, f'stale write returned {response.status_code}; persisted name={child.name}'
