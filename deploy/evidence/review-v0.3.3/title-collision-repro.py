import pytest
from ops_helpers import make_staff, ops_client, post_json
from test_ops_content import question
from dingdong_ca.core.models import QuestionnaireVersion
pytestmark = pytest.mark.django_db

def test_distinct_titles_do_not_retire_each_other():
    client = ops_client(make_staff('content'))
    ids = []
    for title in ['ABC 观察', 'ABC 绘画']:
        r=post_json(client,'/ops/api/questionnaires',{'title':title,'purpose':'exploration'})
        assert r.status_code == 201
        key=r.json()['questionnaire']['id']; ids.append(key)
        assert post_json(client,f'/ops/api/questionnaires/{key}',{'title':title,'description':'隔离验收','questions':[question('Q1')]}).status_code == 200
        assert client.post(f'/api/v1/staff/questionnaires/{key}/publish').status_code == 200
    first=QuestionnaireVersion.objects.get(pk=ids[0])
    assert first.status == 'published', f'Unrelated first title was {first.status}'
